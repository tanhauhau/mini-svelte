import * as fs from 'fs';
import * as acorn from 'acorn';
import * as periscopic from 'periscopic';
import * as estreewalker from 'estree-walker';
import * as escodegen from 'escodegen';

export function buildAppJs() {
  // the basic structure
  const content = fs.readFileSync('./app.svelte', 'utf-8');

  fs.writeFileSync('./app.js', compile(content, 'dom'), 'utf-8');
}

export function buildAppAndSsr() {
  const content = fs.readFileSync('./app.svelte', 'utf-8');
  fs.writeFileSync('./app.js', compile(content, 'dom'), 'utf-8');
  fs.writeFileSync('./ssr.js', compile(content, 'ssr'), 'utf-8');
}

function compile(content, compileTarget) {
  const ast = parse(content);
  const analysis = analyse(ast);
  return compileTarget === 'ssr'
    ? generateSSR(ast, analysis)
    : generate(ast, analysis);
}

function parse(content) {
  let i = 0;
  const ast = {};
  ast.html = parseFragments(() => i < content.length);

  return ast;

  function parseFragments(condition) {
    const fragments = [];
    while (condition()) {
      const fragment = parseFragment();
      if (fragment) {
        fragments.push(fragment);
      }
    }
    return fragments;
  }
  function parseFragment() {
    return parseScript() ?? parseElement() ?? parseExpression() ?? parseText();
  }
  function parseScript() {
    if (match('<script>')) {
      eat('<script>');
      const startIndex = i;
      const endIndex = content.indexOf('</script>', i);
      const code = content.slice(startIndex, endIndex);
      ast.script = acorn.parse(code, { ecmaVersion: 2022 });
      i = endIndex;
      eat('</script>');
    }
  }
  function parseElement() {
    if (match('<')) {
      eat('<');
      const tagName = readWhileMatching(/[a-z]/);
      const attributes = parseAttributeList();
      eat('>');
      const endTag = `</${tagName}>`;

      const element = {
        type: 'Element',
        name: tagName,
        attributes,
        children: parseFragments(() => !match(endTag)),
      };
      eat(endTag);
      return element;
    }
  }
  function parseAttributeList() {
    const attributes = [];
    skipWhitespace();
    while (!match('>')) {
      attributes.push(parseAttribute());
      skipWhitespace();
    }
    return attributes;
  }
  function parseAttribute() {
    const name = readWhileMatching(/[^=]/);
    eat('={');
    const value = parseJavaScript();
    eat('}');
    return {
      type: 'Attribute',
      name,
      value,
    };
  }
  function parseExpression() {
    if (match('{')) {
      eat('{');
      const expression = parseJavaScript();
      eat('}');
      return {
        type: 'Expression',
        expression,
      };
    }
  }
  function parseText() {
    const text = readWhileMatching(/[^<{]/);
    if (text.trim() !== '') {
      return {
        type: 'Text',
        value: text,
      };
    }
  }
  function parseJavaScript() {
    const js = acorn.parseExpressionAt(content, i, { ecmaVersion: 2022 });
    i = js.end;
    return js;
  }

  // return `true` or `false` if the character pointing by `i` matches the string
  function match(str) {
    return content.slice(i, i + str.length) === str;
  }
  function eat(str) {
    if (match(str)) {
      i += str.length;
    } else {
      throw new Error(`Parse error: expecting "${str}"`);
    }
  }
  function readWhileMatching(regex) {
    let startIndex = i;
    while (i < content.length && regex.test(content[i])) {
      i++;
    }
    return content.slice(startIndex, i);
  }
  function skipWhitespace() {
    readWhileMatching(/[\s\n]/);
  }
}
function analyse(ast) {
  const result = {
    variables: new Set(),
    willChange: new Set(),
    willUseInTemplate: new Set(),
  };

  const { scope: rootScope, map, globals } = periscopic.analyze(ast.script);
  result.variables = new Set(rootScope.declarations.keys());
  result.rootScope = rootScope;
  result.map = map;

  const reactiveDeclarations = [];
  const toRemove = new Set();
  ast.script.body.forEach((node, index) => {
    if (node.type === 'LabeledStatement' && node.label.name === '$') {
      toRemove.add(node);
      const body = node.body;
      const left = body.expression.left;
      const right = body.expression.right;
      const dependencies = [];

      estreewalker.walk(right, {
        enter(node) {
          if (node.type === 'Identifier') {
            dependencies.push(node.name);
          }
        },
      });
      result.willChange.add(left.name);
      const reactiveDeclaration = {
        assignees: [left.name],
        dependencies: dependencies,
        node: body,
        index,
      };
      reactiveDeclarations.push(reactiveDeclaration);
    }
  });
  ast.script.body = ast.script.body.filter((node) => !toRemove.has(node));
  result.reactiveDeclarations = reactiveDeclarations;

  let currentScope = rootScope;
  estreewalker.walk(ast.script, {
    enter(node) {
      if (map.has(node)) currentScope = map.get(node);
      if (
        node.type === 'UpdateExpression' ||
        node.type === 'AssignmentExpression'
      ) {
        const names = periscopic.extract_names(
          node.type === 'UpdateExpression' ? node.argument : node.left
        );
        for (const name of names) {
          if (
            currentScope.find_owner(name) === rootScope ||
            globals.has(name)
          ) {
            result.willChange.add(name);
          }
        }
      }
    },
    leave(node) {
      if (map.has(node)) currentScope = currentScope.parent;
    },
  });

  function traverse(fragment) {
    switch (fragment.type) {
      case 'Element':
        fragment.children.forEach((child) => traverse(child));
        fragment.attributes.forEach((attribute) => traverse(attribute));
        break;
      case 'Attribute':
        result.willUseInTemplate.add(fragment.value.name);
        break;
      case 'Expression': {
        extract_names(fragment.expression).forEach((name) => {
          result.willUseInTemplate.add(name);
        });
        break;
      }
    }
  }
  ast.html.forEach((fragment) => traverse(fragment));

  return result;
}
function generate(ast, analysis) {
  const code = {
    variables: [],
    create: [],
    update: [],
    destroy: [],
    reactiveDeclarations: [],
  };

  let counter = 1;
  let hydration_index = 0;
  let hydration_parent = 'target';
  function traverse(node, parent) {
    switch (node.type) {
      case 'Element': {
        const variableName = `${node.name}_${counter++}`;
        code.variables.push(variableName);
        code.create.push(
          `${variableName} = should_hydrate ? ${hydration_parent}.childNodes[${hydration_index++}] : document.createElement('${
            node.name
          }');`
        );
        node.attributes.forEach((attribute) => {
          traverse(attribute, variableName);
        });

        const current_hydration_parent = hydration_parent;
        const current_hydration_index = hydration_index;
        hydration_parent = variableName;
        hydration_index = 0;
        node.children.forEach((child) => {
          traverse(child, variableName);
        });
        hydration_parent = current_hydration_parent;
        hydration_index = current_hydration_index;

        code.create.push(
          `if (!should_hydrate) ${parent}.appendChild(${variableName})`
        );
        code.destroy.push(`${parent}.removeChild(${variableName})`);
        break;
      }
      case 'Text': {
        const variableName = `txt_${counter++}`;
        code.variables.push(variableName);
        code.create.push(
          `${variableName} = should_hydrate ? ${hydration_parent}.childNodes[${hydration_index++}] : document.createTextNode('${
            node.value
          }')`
        );
        hydration_index++;
        code.create.push(
          `if (!should_hydrate) ${parent}.appendChild(${variableName})`
        );
        break;
      }
      case 'Attribute': {
        if (node.name.startsWith('on:')) {
          const eventName = node.name.slice(3);
          const eventHandler = node.value.name;
          code.create.push(
            `${parent}.addEventListener('${eventName}', ${eventHandler});`
          );
          code.destroy.push(
            `${parent}.removeEventListener('${eventName}', ${eventHandler});`
          );
        }
        break;
      }
      case 'Expression': {
        const variableName = `txt_${counter++}`;
        const expressionStr = escodegen.generate(node.expression);
        code.variables.push(variableName);
        code.create.push(
          `${variableName} = should_hydrate ? ${hydration_parent}.childNodes[${hydration_index++}] : document.createTextNode(${expressionStr})`
        );
        hydration_index++;
        code.create.push(
          `if (!should_hydrate) ${parent}.appendChild(${variableName});`
        );
        const names = extract_names(node.expression);
        if (names.some((name) => analysis.willChange.has(name))) {
          const changes = new Set();
          names.forEach((name) => {
            if (analysis.willChange.has(name)) {
              changes.add(name);
            }
          });
          let condition;
          if (changes.size > 1) {
            condition = `${JSON.stringify(
              Array.from(changes)
            )}.some(name => changed.includes(name))`;
          } else {
            condition = `changed.includes('${Array.from(changes)[0]}')`;
          }
          code.update.push(`if (${condition}) {
            ${variableName}.data = ${expressionStr};
          }`);
        }
        break;
      }
    }
  }

  ast.html.forEach((fragment) => traverse(fragment, 'target'));

  const { rootScope, map } = analysis;
  let currentScope = rootScope;
  estreewalker.walk(ast.script, {
    enter(node, parent) {
      if (map.has(node)) currentScope = map.get(node);
      if (
        node.type === 'UpdateExpression' ||
        node.type === 'AssignmentExpression'
      ) {
        const names = periscopic
          .extract_names(
            node.type === 'UpdateExpression' ? node.argument : node.left
          )
          .filter(
            (name) =>
              currentScope.find_owner(name) === rootScope &&
              analysis.willUseInTemplate.has(name)
          );
        if (names.length > 0) {
          this.replace({
            type: 'SequenceExpression',
            expressions: [
              node,
              acorn.parseExpressionAt(`update(${JSON.stringify(names)})`, 0, {
                ecmaVersion: 2022,
              }),
            ],
          });
          this.skip();
        }
      }
      if (node.type === 'VariableDeclarator' && parent.kind !== 'const') {
        const name = node.id.name;
        if (currentScope.find_owner(name) === rootScope) {
          this.replace({
            type: 'VariableDeclarator',
            id: node.id,
            init: {
              type: 'LogicalExpression',
              operator: '??',
              left: acorn.parseExpressionAt(
                `restored_state?.${node.id.name}`,
                0,
                { ecmaVersion: 2022 }
              ),
              right: node.init,
            },
          });
          this.skip();
        }
      }
    },
    leave(node) {
      if (map.has(node)) currentScope = currentScope.parent;
    },
  });

  // [1,2,3].sort((a, b) => a - b)
  // if (a > b) a-b > 1
  // if (b > a) a-b > -1
  analysis.reactiveDeclarations.sort((rd1, rd2) => {
    // rd2 depends on what rd1 changes
    if (rd1.assignees.some((assignee) => rd2.dependencies.includes(assignee))) {
      // rd2 should come after rd1
      return -1;
    }

    // rd1 depends on what rd2 changes
    if (rd2.assignees.some((assignee) => rd1.dependencies.includes(assignee))) {
      // rd1 should come after rd2
      return 1;
    }

    // based on original order
    return rd1.index - rd2.index;
  });

  analysis.reactiveDeclarations.forEach(
    ({ node, index, assignees, dependencies }) => {
      code.reactiveDeclarations.push(`
      if (${JSON.stringify(
        Array.from(dependencies)
      )}.some(name => collectChanges.includes(name))) {
        ${escodegen.generate(node)}
        update(${JSON.stringify(assignees)});
      }
    `);
      assignees.forEach((assignee) => code.variables.push(assignee));
    }
  );

  return `
    export default function({ restored_state } = {}) {
      ${code.variables.map((v) => `let ${v};`).join('\n')}

      let collectChanges = [];
      let updateCalled = false;
      function update(changed) {
        changed.forEach(c => collectChanges.push(c));
    
        if (updateCalled) return;
        updateCalled = true;
    
        // first call
        update_reactive_declarations();
        if (typeof lifecycle !== 'undefined') lifecycle.update(collectChanges);
        collectChanges = [];
        updateCalled = false;
      }

      ${escodegen.generate(ast.script)}

      update(${JSON.stringify(Array.from(analysis.willChange))});

      function update_reactive_declarations() {
        ${code.reactiveDeclarations.join('\n')}
      }

      var lifecycle = {
        create(target, should_hydrate = target.childNodes.length > 0) {
          ${code.create.join('\n')}
        },
        update(changed) {
          ${code.update.join('\n')}
        },
        destroy(target) {
          ${code.destroy.join('\n')}
        },
        capture_state() {
          return { ${Array.from(analysis.variables).join(',')} };
        }
      };
      return lifecycle;
    }
  `;
}

function generateSSR(ast, analysis) {
  const code = {
    variables: [],
    reactiveDeclarations: [],
    template: {
      expressions: [],
      quasis: [],
    },
  };

  let templateString = '';
  function addString(str) {
    templateString += str;
  }
  function addExpressions(expression) {
    code.template.quasis.push(templateString);
    templateString = '';
    code.template.expressions.push(expression);
  }

  function traverse(node) {
    switch (node.type) {
      case 'Element': {
        addString(`<${node.name}`);
        node.attributes.forEach((attribute) => {
          traverse(attribute);
        });
        addString('>');
        node.children.forEach((child) => {
          traverse(child);
        });
        addString(`</${node.name}>`);
        break;
      }
      case 'Text': {
        addString(node.value);
        addString('<!---->');
        break;
      }
      case 'Attribute': {
        break;
      }
      case 'Expression': {
        addExpressions(node.expression);
        addString('<!---->');
        break;
      }
    }
  }

  ast.html.forEach((fragment) => traverse(fragment));

  code.template.quasis.push(templateString);

  // [1,2,3].sort((a, b) => a - b)
  // if (a > b) a-b > 1
  // if (b > a) a-b > -1
  analysis.reactiveDeclarations.sort((rd1, rd2) => {
    // rd2 depends on what rd1 changes
    if (rd1.assignees.some((assignee) => rd2.dependencies.includes(assignee))) {
      // rd2 should come after rd1
      return -1;
    }

    // rd1 depends on what rd2 changes
    if (rd2.assignees.some((assignee) => rd1.dependencies.includes(assignee))) {
      // rd1 should come after rd2
      return 1;
    }

    // based on original order
    return rd1.index - rd2.index;
  });

  analysis.reactiveDeclarations.forEach(
    ({ node, index, assignees, dependencies }) => {
      code.reactiveDeclarations.push(escodegen.generate(node));
      assignees.forEach((assignee) => code.variables.push(assignee));
    }
  );

  const templateLiteral = {
    type: 'TemplateLiteral',
    expressions: code.template.expressions,
    quasis: code.template.quasis.map((str) => ({
      type: 'TemplateElement',
      value: {
        raw: str,
        cooked: str,
      },
    })),
  };

  return `
    export default function() {
      ${code.variables.map((v) => `let ${v};`).join('\n')}
      ${escodegen.generate(ast.script)}
      ${code.reactiveDeclarations.join('\n')}

      return ${escodegen.generate(templateLiteral)};
    }
  `;
}

function extract_names(jsNode, result = []) {
  switch (jsNode.type) {
    case 'Identifier':
      result.push(jsNode.name);
      break;
    case 'BinaryExpression':
      extract_names(jsNode.left, result);
      extract_names(jsNode.right, result);
      break;
  }
  return result;
}

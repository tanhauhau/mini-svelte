import * as fs from 'fs';
import * as acorn from 'acorn';
import * as periscopic from 'periscopic';
import * as estreewalker from 'estree-walker';
import * as escodegen from 'escodegen';

// the basic structure
const content = fs.readFileSync('./app.svelte', 'utf-8');
const ast = parse(content);
const analysis = analyse(ast);
const js = generate(ast, analysis);

fs.writeFileSync('./app.js', js, 'utf-8');

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

  const { scope: rootScope, map } = periscopic.analyze(ast.script);
  result.variables = new Set(rootScope.declarations.keys());
  result.rootScope = rootScope;
  result.map = map;

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
          if (currentScope.find_owner(name) === rootScope) {
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
  };

  let counter = 1;
  function traverse(node, parent) {
    switch (node.type) {
      case 'Element': {
        const variableName = `${node.name}_${counter++}`;
        code.variables.push(variableName);
        code.create.push(
          `${variableName} = document.createElement('${node.name}');`
        );
        node.attributes.forEach((attribute) => {
          traverse(attribute, variableName);
        });
        node.children.forEach((child) => {
          traverse(child, variableName);
        });
        code.create.push(`${parent}.appendChild(${variableName})`);
        code.destroy.push(`${parent}.removeChild(${variableName})`);
        break;
      }
      case 'Text': {
        const variableName = `txt_${counter++}`;
        code.variables.push(variableName);
        code.create.push(
          `${variableName} = document.createTextNode('${node.value}')`
        );
        code.create.push(`${parent}.appendChild(${variableName})`);
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
          `${variableName} = document.createTextNode(${expressionStr})`
        );
        code.create.push(`${parent}.appendChild(${variableName});`);
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
    enter(node) {
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
              acorn.parseExpressionAt(
                `lifecycle.update(${JSON.stringify(names)})`,
                0,
                {
                  ecmaVersion: 2022,
                }
              ),
            ],
          });
          this.skip();
        }
      }
    },
    leave(node) {
      if (map.has(node)) currentScope = currentScope.parent;
    },
  });
  return `
    export default function() {
      ${code.variables.map((v) => `let ${v};`).join('\n')}
      ${escodegen.generate(ast.script)}
      const lifecycle = {
        create(target) {
          ${code.create.join('\n')}
        },
        update(changed) {
          ${code.update.join('\n')}
        },
        destroy() {
          ${code.destroy.join('\n')}
        },
      };
      return lifecycle;
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

export default function ({ restored_state } = {}) {
  let button_1;
  let txt_2;
  let div_3;
  let txt_4;
  let txt_5;
  let txt_6;
  let div_7;
  let txt_8;
  let txt_9;
  let txt_10;
  let div_11;
  let txt_12;
  let txt_13;
  let button_14;
  let txt_15;
  let button_16;
  let txt_17;
  let bar;
  let double;
  let quadruple;

  let collectChanges = [];
  let updateCalled = false;
  function update(changed) {
    changed.forEach((c) => collectChanges.push(c));

    if (updateCalled) return;
    updateCalled = true;

    // first call
    update_reactive_declarations();
    if (typeof lifecycle !== 'undefined') lifecycle.update(collectChanges);
    collectChanges = [];
    updateCalled = false;
  }

  let counter = restored_state?.counter ?? 5;
  let foo = restored_state?.foo ?? 5;
  const increment = () => (counter++, update(['counter']));
  const decrement = () => (counter--, update(['counter']));
  const incrementFoo = () => (foo++, update(['foo']));

  update(['quadruple', 'double', 'bar', 'counter', 'foo']);

  function update_reactive_declarations() {
    if (['foo'].some((name) => collectChanges.includes(name))) {
      bar = foo + 5;
      update(['bar']);
    }

    if (['counter', 'bar'].some((name) => collectChanges.includes(name))) {
      double = counter * 2 + bar;
      update(['double']);
    }

    if (['double'].some((name) => collectChanges.includes(name))) {
      quadruple = double * 2;
      update(['quadruple']);
    }
  }

  var lifecycle = {
    create(target, should_hydrate = target.childNodes.length > 0) {
      button_1 = should_hydrate
        ? target.childNodes[0]
        : document.createElement('button');
      button_1.addEventListener('click', decrement);
      txt_2 = should_hydrate
        ? button_1.childNodes[0]
        : document.createTextNode('Decrement');
      if (!should_hydrate) button_1.appendChild(txt_2);
      if (!should_hydrate) target.appendChild(button_1);
      div_3 = should_hydrate
        ? target.childNodes[1]
        : document.createElement('div');
      txt_4 = should_hydrate
        ? div_3.childNodes[0]
        : document.createTextNode(counter);
      if (!should_hydrate) div_3.appendChild(txt_4);
      txt_5 = should_hydrate
        ? div_3.childNodes[2]
        : document.createTextNode(' * 2 = ');
      if (!should_hydrate) div_3.appendChild(txt_5);
      txt_6 = should_hydrate
        ? div_3.childNodes[4]
        : document.createTextNode(double);
      if (!should_hydrate) div_3.appendChild(txt_6);
      if (!should_hydrate) target.appendChild(div_3);
      div_7 = should_hydrate
        ? target.childNodes[2]
        : document.createElement('div');
      txt_8 = should_hydrate
        ? div_7.childNodes[0]
        : document.createTextNode(double);
      if (!should_hydrate) div_7.appendChild(txt_8);
      txt_9 = should_hydrate
        ? div_7.childNodes[2]
        : document.createTextNode(' * 2 = ');
      if (!should_hydrate) div_7.appendChild(txt_9);
      txt_10 = should_hydrate
        ? div_7.childNodes[4]
        : document.createTextNode(quadruple);
      if (!should_hydrate) div_7.appendChild(txt_10);
      if (!should_hydrate) target.appendChild(div_7);
      div_11 = should_hydrate
        ? target.childNodes[3]
        : document.createElement('div');
      txt_12 = should_hydrate
        ? div_11.childNodes[0]
        : document.createTextNode('foo = ');
      if (!should_hydrate) div_11.appendChild(txt_12);
      txt_13 = should_hydrate
        ? div_11.childNodes[2]
        : document.createTextNode(foo);
      if (!should_hydrate) div_11.appendChild(txt_13);
      if (!should_hydrate) target.appendChild(div_11);
      button_14 = should_hydrate
        ? target.childNodes[4]
        : document.createElement('button');
      button_14.addEventListener('click', increment);
      txt_15 = should_hydrate
        ? button_14.childNodes[0]
        : document.createTextNode('Increment');
      if (!should_hydrate) button_14.appendChild(txt_15);
      if (!should_hydrate) target.appendChild(button_14);
      button_16 = should_hydrate
        ? target.childNodes[5]
        : document.createElement('button');
      button_16.addEventListener('click', incrementFoo);
      txt_17 = should_hydrate
        ? button_16.childNodes[0]
        : document.createTextNode('Increment Foo');
      if (!should_hydrate) button_16.appendChild(txt_17);
      if (!should_hydrate) target.appendChild(button_16);
    },
    update(changed) {
      if (changed.includes('counter')) {
        txt_4.data = counter;
      }
      if (changed.includes('double')) {
        txt_6.data = double;
      }
      if (changed.includes('double')) {
        txt_8.data = double;
      }
      if (changed.includes('quadruple')) {
        txt_10.data = quadruple;
      }
      if (changed.includes('foo')) {
        txt_13.data = foo;
      }
    },
    destroy(target) {
      button_1.removeEventListener('click', decrement);
      target.removeChild(button_1);
      target.removeChild(div_3);
      target.removeChild(div_7);
      target.removeChild(div_11);
      button_14.removeEventListener('click', increment);
      target.removeChild(button_14);
      button_16.removeEventListener('click', incrementFoo);
      target.removeChild(button_16);
    },
    capture_state() {
      return { counter, foo, increment, decrement, incrementFoo };
    },
  };
  return lifecycle;
}

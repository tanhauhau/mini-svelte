
    export default function({ restored_state } = {}) {
      let div_1;
let img_2;
let button_3;
let txt_4;
let div_5;
let txt_6;
let txt_7;
let txt_8;
let div_9;
let txt_10;
let txt_11;
let txt_12;
let div_13;
let txt_14;
let txt_15;
let button_16;
let txt_17;
let button_18;
let txt_19;
let bar;
let double;
let quadruple;

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

      let counter = restored_state?.counter ?? 5;
let foo = restored_state?.foo ?? 5;
const increment = () => (counter++, update(['counter']));
const decrement = () => (counter--, update(['counter']));
const incrementFoo = () => (foo++, update(['foo']));

      update(["quadruple","double","bar","counter","foo"]);

      function update_reactive_declarations() {
        
      if (["foo"].some(name => collectChanges.includes(name))) {
        bar = foo + 5;
        update(["bar"]);
      }
    

      if (["counter","bar"].some(name => collectChanges.includes(name))) {
        double = counter * 2 + bar;
        update(["double"]);
      }
    

      if (["double"].some(name => collectChanges.includes(name))) {
        quadruple = double * 2;
        update(["quadruple"]);
      }
    
      }

      var lifecycle = {
        create(target, should_hydrate = target.childNodes.length > 0) {
          div_1 = should_hydrate ? target.childNodes[0] : document.createElement('div');
img_2 = should_hydrate ? div_1.childNodes[0] : document.createElement('img');
if (!should_hydrate) div_1.appendChild(img_2)
if (!should_hydrate) target.appendChild(div_1)
button_3 = should_hydrate ? target.childNodes[1] : document.createElement('button');
button_3.addEventListener('click', decrement);
txt_4 = should_hydrate ? button_3.childNodes[0] : document.createTextNode('Decrement')
if (!should_hydrate) button_3.appendChild(txt_4)
if (!should_hydrate) target.appendChild(button_3)
div_5 = should_hydrate ? target.childNodes[2] : document.createElement('div');
txt_6 = should_hydrate ? div_5.childNodes[0] : document.createTextNode(counter)
if (!should_hydrate) div_5.appendChild(txt_6);
txt_7 = should_hydrate ? div_5.childNodes[2] : document.createTextNode(' * 2 = ')
if (!should_hydrate) div_5.appendChild(txt_7)
txt_8 = should_hydrate ? div_5.childNodes[4] : document.createTextNode(double)
if (!should_hydrate) div_5.appendChild(txt_8);
if (!should_hydrate) target.appendChild(div_5)
div_9 = should_hydrate ? target.childNodes[3] : document.createElement('div');
txt_10 = should_hydrate ? div_9.childNodes[0] : document.createTextNode(double)
if (!should_hydrate) div_9.appendChild(txt_10);
txt_11 = should_hydrate ? div_9.childNodes[2] : document.createTextNode(' * 2 = ')
if (!should_hydrate) div_9.appendChild(txt_11)
txt_12 = should_hydrate ? div_9.childNodes[4] : document.createTextNode(quadruple)
if (!should_hydrate) div_9.appendChild(txt_12);
if (!should_hydrate) target.appendChild(div_9)
div_13 = should_hydrate ? target.childNodes[4] : document.createElement('div');
txt_14 = should_hydrate ? div_13.childNodes[0] : document.createTextNode('foo = ')
if (!should_hydrate) div_13.appendChild(txt_14)
txt_15 = should_hydrate ? div_13.childNodes[2] : document.createTextNode(foo)
if (!should_hydrate) div_13.appendChild(txt_15);
if (!should_hydrate) target.appendChild(div_13)
button_16 = should_hydrate ? target.childNodes[5] : document.createElement('button');
button_16.addEventListener('click', increment);
txt_17 = should_hydrate ? button_16.childNodes[0] : document.createTextNode('Increment')
if (!should_hydrate) button_16.appendChild(txt_17)
if (!should_hydrate) target.appendChild(button_16)
button_18 = should_hydrate ? target.childNodes[6] : document.createElement('button');
button_18.addEventListener('click', incrementFoo);
txt_19 = should_hydrate ? button_18.childNodes[0] : document.createTextNode('Increment Foo')
if (!should_hydrate) button_18.appendChild(txt_19)
if (!should_hydrate) target.appendChild(button_18)
        },
        update(changed) {
          if (changed.includes('counter')) {
            txt_6.data = counter;
          }
if (changed.includes('double')) {
            txt_8.data = double;
          }
if (changed.includes('double')) {
            txt_10.data = double;
          }
if (changed.includes('quadruple')) {
            txt_12.data = quadruple;
          }
if (changed.includes('foo')) {
            txt_15.data = foo;
          }
        },
        destroy(target) {
          div_1.removeChild(img_2)
target.removeChild(div_1)
button_3.removeEventListener('click', decrement);
target.removeChild(button_3)
target.removeChild(div_5)
target.removeChild(div_9)
target.removeChild(div_13)
button_16.removeEventListener('click', increment);
target.removeChild(button_16)
button_18.removeEventListener('click', incrementFoo);
target.removeChild(button_18)
        },
        capture_state() {
          return { counter,foo,increment,decrement,incrementFoo };
        }
      };
      return lifecycle;
    }
  
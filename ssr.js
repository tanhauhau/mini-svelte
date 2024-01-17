
    export default function() {
      let bar;
let double;
let quadruple;
      let counter = 5;
let foo = 5;
const increment = () => counter++;
const decrement = () => counter--;
const incrementFoo = () => foo++;
      bar = foo + 5;
double = counter * 2 + bar;
quadruple = double * 2;

      return `<div><img></img></div><button>Decrement<!----></button><div>${ counter }<!----> * 2 = <!---->${ double }<!----></div><div>${ double }<!----> * 2 = <!---->${ quadruple }<!----></div><div>foo = <!---->${ foo }<!----></div><button>Increment<!----></button><button>Increment Foo<!----></button>`;
    }
  
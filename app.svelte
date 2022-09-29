<script>
  let counter = 5;
  let foo = 5;
  const increment = () => counter++;
  const decrement = () => counter--;
  const incrementFoo = () => foo++;
  
  $: quadruple = double * 2;
  $: double = counter * 2 + bar;
  
  $: bar = foo + 5;

</script>

<button on:click={decrement}>Decrement</button>
<div>{counter} * 2 = {double}</div>
<div>{double} * 2 = {quadruple}</div>
<div>foo = {foo}</div>
<button on:click={increment}>Increment</button>
<button on:click={incrementFoo}>Increment Foo</button>
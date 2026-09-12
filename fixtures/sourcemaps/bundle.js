// fixtures/sourcemaps/_src.js
function calculate(x) {
  if (x <= 0) {
    throw new Error("invalid input");
  }
  return x * 2;
}
function main() {
  calculate(0);
}
export {
  calculate,
  main
};
//# sourceMappingURL=bundle.js.map

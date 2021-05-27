export const fizzBuzz = () => {
    return Array
        .from({length: 100}, (el, i) => i)
        .map(el =>
            el % 15 === 0
                ? "FizzBuzz"
                : el % 3 === 0
                ? 'Fizz'
                : el % 5 === 0
                    ? 'Buzz'
                    : el)
}

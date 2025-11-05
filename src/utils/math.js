export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const randomRange = (min, max) => Math.random() * (max - min) + min;
export const chance = (probability) => Math.random() < probability;

export const weightedPick = (options) => {
  let total = 0;
  for (const option of options) {
    total += option.weight;
  }
  let roll = Math.random() * total;
  for (const option of options) {
    if (roll < option.weight) {
      return option.value;
    }
    roll -= option.weight;
  }
  return options[options.length - 1].value;
};

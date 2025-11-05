export function updateList(list, updater) {
  let write = 0;
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (updater(item) !== false) {
      list[write] = item;
      write += 1;
    }
  }
  list.length = write;
}

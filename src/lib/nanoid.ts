const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export function nanoid(len = 12): string {
  let id = "";
  for (let i = 0; i < len; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return id;
}

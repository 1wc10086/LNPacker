const values = new Map();

module.exports = {
  getItem: jest.fn(async key => values.get(key) ?? null),
  setItem: jest.fn(async (key, value) => values.set(key, value)),
  removeItem: jest.fn(async key => values.delete(key)),
  clear: jest.fn(async () => values.clear()),
};

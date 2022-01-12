module.exports = {
  uid: () => {
    const head = Date.now().toString(36);
    const middle = Math.random().toString(36).substring(2);
    const tail = Math.random().toString(36).substring(2);
    return `${head}-${middle}-${tail}`;
  },
};

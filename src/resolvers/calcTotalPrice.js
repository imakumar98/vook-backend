const {getPrice} = require('./utilFunctions');




module.exports =  function calcTotalPrice(cart) {
  return cart.reduce((tally, cartItem) => {
    if (!cartItem.product) return tally;
    return tally + cartItem.quantity * getPrice(cartItem.product.mrp,cartItem.product.discount);
  }, 0);
}

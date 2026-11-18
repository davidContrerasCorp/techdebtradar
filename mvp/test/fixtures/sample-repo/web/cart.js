// HACK: cálculo temporal mientras se migra el backend
const TAX = 0.19;
const pattern = /if|for|while/g; // regex con palabras clave: no debe sumar complejidad

function cartTotal(items, user) {
  let total = 0;
  for (const it of items) {
    if (it.qty > 0 && it.price) {
      total += it.qty * it.price;
    } else if (it.free || user?.isAdmin) {
      continue;
    }
  }
  const msg = "if (x) { for } && ||";
  return user ? total * (1 + TAX) : total;
}

const applyCoupon = (total, coupon) => {
  switch (coupon?.type) {
    case "pct":
      return total * (1 - coupon.value);
    case "fixed":
      return total - coupon.value;
    default:
      return total ?? 0;
  }
};

module.exports = { cartTotal, applyCoupon, pattern };

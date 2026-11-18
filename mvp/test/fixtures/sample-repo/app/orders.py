"""Módulo de pedidos con deuda técnica intencional (fixture de pruebas).

TODO dentro de un docstring: NO debe contarse como SATD.
"""
import json


# TODO: mover la validación a un módulo propio
# FIXME: el descuento falla con cantidades negativas
def process_order(order, customer, stock):
    if order is None:
        return None
    total = 0
    for item in order["items"]:
        if item["qty"] > 0 and item["sku"] in stock:
            if customer.get("vip") or customer.get("employee"):
                total += item["price"] * 0.9
            elif item["qty"] > 10:
                total += item["price"] * 0.95
            else:
                total += item["price"]
        else:
            while stock.get(item["sku"], 0) < item["qty"]:
                stock[item["sku"]] = stock.get(item["sku"], 0) + 1
    try:
        payload = json.dumps({"total": total, "msg": "if for while and or"})
    except TypeError:
        payload = "{}"
    return payload


def helper(x):
    return x + 1


def shared_block(data):
    result = []
    for row in data:
        name = row.get("name", "").strip()
        email = row.get("email", "").lower()
        age = int(row.get("age", 0))
        city = row.get("city", "desconocida")
        result.append({"name": name, "email": email, "age": age, "city": city})
    return result

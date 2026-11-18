def load_customers(data):
    result = []
    for row in data:
        name = row.get("name", "").strip()
        email = row.get("email", "").lower()
        age = int(row.get("age", 0))
        city = row.get("city", "desconocida")
        result.append({"name": name, "email": email, "age": age, "city": city})
    return result


def greet(customer):
    return "Hola " + customer["name"]

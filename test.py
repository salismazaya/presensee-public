salis_mantap = ["salis", "keren", "salis", "salis", "keren"]


oh = sorted(salis_mantap, key = lambda x: 1 if x == "salis" else 0)
print(list(oh))
import base64

with open('scripts/vercel-install.sh', 'r') as f:
    text = f.read()

# Instead of hardcoding exit 1, use base64 decoding to write it back.
search_encoded = b"""cm0gLXJmIC5ib29raWppLXRtcApybSAtcmYgLmJvb2tpamktcGFja2FnZXMKCg==""".decode('utf-8')
replace_encoded = b"""aWYgWyAtZCAibW9ub3JlcG8tcGFja2FnZXMiIF0gJiYgWyAtZiAibW9ub3JlcG8tcGFja2FnZXMvYWktcnVudGltZS9wYWNrYWdlLmpzb24iIF07IHRoZW4KICBlY2hvICJtb25vcmVwby1wYWNrYWdlcyBhbHJlYWR5IGV4aXN0cy4gU2tpcHBpbmcgY2xvbmUuIgplbHNlCiAgcm0gLXJmIC5ib29raWppLXRtcAogIHJtIC1yZiAuYm9va2lqaS1wYWNrYWdlcwoK""".decode('utf-8')

# The end part
search2_encoded = b"""Y3AgLWEgLmJvb2tpamktcGFja2FnZXMgbW9ub3JlcG8tcGFja2FnZXM=""".decode('utf-8')
replace2_encoded = b"""Y3AgLWEgLmJvb2tpamktcGFja2FnZXMgbW9ub3JlcG8tcGFja2FnZXMKZmk=""".decode('utf-8')

import base64
text = text.replace(base64.b64decode(search_encoded).decode('utf-8'), base64.b64decode(replace_encoded).decode('utf-8'))
text = text.replace(base64.b64decode(search2_encoded).decode('utf-8'), base64.b64decode(replace2_encoded).decode('utf-8'))

with open('scripts/vercel-install.sh', 'w') as f:
    f.write(text)

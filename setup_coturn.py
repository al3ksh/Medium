import secrets
secret = secrets.token_hex(32)
path = "/etc/turnserver.conf"
content = f"""listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret={secret}
realm=medium.aleksh.xyz
total-quota=100
stale-nonce=600
no-multicast-peers
no-cli
log-file=/var/log/turnserver.log
"""
with open(path, "w") as f:
    f.write(content)
print(f"TURN_SECRET={secret}")

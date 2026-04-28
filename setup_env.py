import secrets
path = "/home/alexpi/apps/Medium/server/.env"
content = f"""PASSPHRASE={secrets.token_hex(16)}
PASSPHRASE_ENABLED=false
JWT_SECRET={secrets.token_hex(32)}
PORT=3001
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=20971520
CLEANUP_INTERVAL=3600000
GIPHY_API_KEY=Zb2aNae2ySxvqlrcPta0oMgVvDr4x91P
PRIVATE_PASSWORD={secrets.token_hex(8)}
"""
with open(path, "w") as f:
    f.write(content)
print("Done")

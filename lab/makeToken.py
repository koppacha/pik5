import random
import string

# このプロジェクトでは、.envにトークンを設定する場合Token68に準拠することとします
# このスクリプトを実行するとトークンを生成します
token68_chars = string.ascii_letters + string.digits + '-_.~+/'

# k=n文字の文字をランダム生成
token68_string = ''.join(random.choices(token68_chars, k=64))

print(token68_string)

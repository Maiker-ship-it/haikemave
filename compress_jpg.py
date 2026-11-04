from PIL import Image
import os

img_dir = r"D:\js实训作业合集\xxl更进版\img"
for f in ['bg-endless.jpg', 'bg-menu.jpg']:
    path = os.path.join(img_dir, f)
    before = os.path.getsize(path)
    img = Image.open(path)
    if img.width > 800:
        ratio = 800 / img.width
        img = img.resize((800, int(img.height * ratio)), Image.LANCZOS)
    img.save(path, 'JPEG', quality=60, optimize=True)
    after = os.path.getsize(path)
    print(f"{f}: {before//1024}KB -> {after//1024}KB")

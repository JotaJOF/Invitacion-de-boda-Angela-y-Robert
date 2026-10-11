import fitz
from pathlib import Path
source = Path('attached_assets/PROYECTO_BODA_1791702680250.pdf')
out = Path('.agents/outputs')
doc = fitz.open(source)
print('pages:', len(doc))
print('metadata:', doc.metadata)
for i, page in enumerate(doc):
    print(f'page {i+1}: size={page.rect.width:.1f} x {page.rect.height:.1f} pt; images={len(page.get_images(full=True))}; text_chars={len(page.get_text())}')
    pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
    target = out / f'wedding_page_{i+1}.png'
    pix.save(target)
    print('rendered:', target, f'{pix.width}x{pix.height}')

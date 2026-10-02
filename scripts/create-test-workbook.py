from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape

destination = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures'
destination.mkdir(parents=True, exist_ok=True)
headers = ['Référence', 'Produit', 'Marque', 'Segment', 'Sous-segment', 'CA', 'Quantité', 'Notre référence']
sheet_data = [
    [headers, ['T1', 'Tomates pelées', 'Maison', 'Légumes', 'Tomates', 1000.50, 20, True], ['M1', 'Maïs doux', 'Autre', 'Légumes', 'Maïs', 500.25, 10, False]],
    [headers, ['G1', 'Haricots rouges', 'Maison', 'Grains', 'Haricots', 2500.75, 25, True], ['G2', 'Pois chiches', 'Autre', 'Grains', 'Pois', 1250.25, 12, False]],
]
def sheet_xml(data):
    rows=[]
    for r, row in enumerate(data, 1):
        cells=[]
        for c, value in enumerate(row):
            address=f'{chr(65+c)}{r}'
            if isinstance(value, bool): cells.append(f'<c r="{address}" t="b"><v>{int(value)}</v></c>')
            elif isinstance(value, (int,float)): cells.append(f'<c r="{address}"><v>{value}</v></c>')
            else: cells.append(f'<c r="{address}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>')
        rows.append(f'<row r="{r}">{"".join(cells)}</row>')
    return '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(rows)+'</sheetData></worksheet>'
with ZipFile(destination / 'ventes-multi-onglets.xlsx', 'w', ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
    z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Légumes" sheetId="1" r:id="rId1"/><sheet name="Grains" sheetId="2" r:id="rId2"/></sheets></workbook>')
    z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>')
    for i, data in enumerate(sheet_data, 1): z.writestr(f'xl/worksheets/sheet{i}.xml', sheet_xml(data))
(destination / 'ventes-invalides.csv').write_text('Référence;Produit;Marque;Segment;Sous-segment;CA;Quantité;Notre référence\nT1;Tomates;Maison;Légumes;Tomates;1234,56;10;oui\nT2;Tomates;Autre;Légumes;Tomates;pas un montant;20;non\nM1;Maïs;Autre;Légumes;Maïs;500,25;5;non\n', encoding='utf-8')

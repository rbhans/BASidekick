"""Source-only checks. Does not compile or load any Niagara classes."""
from pathlib import Path
import hashlib, json, re, subprocess, xml.etree.ElementTree as ET
from slot_contracts import check_slot_contracts
root = Path(__file__).resolve().parents[1]
registered = {}
manual_slots_checked = 0
for part in ('rt','ux','wb'):
    for item in ET.parse(root/f'basidekick-{part}/module-include.xml').getroot():
        name = item.get('name')
        assert name not in registered, name
        classname = item.get('class')
        source = root/f'basidekick-{part}/src'/Path(classname.replace('.','/')+'.java')
        assert source.is_file(), source
        manual_slots_checked += check_slot_contracts(source.read_text(), source.name)
        registered[name] = str(source.relative_to(root))
for source in root.rglob('*'):
    if source.name.startswith('._') or not source.is_file(): continue
    if source.suffix in ('.xml','.palette'): ET.parse(source)
    if source.suffix == '.js' and 'src' in source.parts: subprocess.run(['node','--check',str(source)], check=True)
palette = ET.parse(root/'basidekick-wb/module.palette').getroot()
# Native bindings require BWidget parents. A plain folder cannot store their
# palette prototypes; Niagara's UnrestrictedFolder explicitly permits this.
for parent in palette.iter('p'):
    for child in parent.findall('p'):
        if child.get('t','').endswith('Binding'):
            assert parent.get('t') != 'b:Folder', (
                'Binding prototype requires an UnrestrictedFolder or widget parent',
                parent.get('n'), child.get('n'))
for entry in palette.iter('p'):
    typ = entry.get('t','')
    if typ.startswith('bask:'): assert typ.split(':')[1] in registered, typ
    value = entry.get('v','')
    background = re.search(r'source\((module://basidekick/Backgrounds/[^)]+)\)', value)
    if background:
        assert (root/'basidekick-wb/src'/background.group(1).split('module://basidekick/')[1]).is_file(), value
    if value.startswith('module://basidekick/Icons/'):
        assert (root/'basidekick-wb/src'/value.split('module://basidekick/')[1]).is_file(), value
result = {'registeredTypes':len(registered), 'manualSlotContracts':manual_slots_checked, 'javaScriptSyntax':'pass', 'xmlAndPaletteReferences':'pass', 'niagaraCompilation':'not run', 'niagaraRuntime':'not run'}
(root/'task-reports/static-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))

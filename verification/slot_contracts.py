"""Source checks for this module's manually maintained Niagara slot methods.

Niagara 4.15 ComplexIntrospector requires property getter/setter pairs and
action invocation methods as well as do-methods. This is not runtime loading.
"""
import re


def check_slot_contracts(source, filename):
    if '@NoSlotomatic' not in source:
        return 0
    methods = {}
    pattern = (r'public\s+(?:(?:final|synchronized|static)\s+)*'
               r'([\w.<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)')
    for result, name, args in re.findall(pattern, source):
        params = tuple(arg.strip().split()[-2] for arg in args.split(',') if arg.strip())
        methods.setdefault(name, []).append((result, params))
    slots = re.findall(r'public\s+static\s+final\s+(Property|Action)\s+(\w+)\s*=', source)
    for kind, name in slots:
        title = name[0].upper() + name[1:]
        prefix = f'{filename}: {kind} {name}'
        if kind == 'Property':
            getters = [m for m in methods.get('get' + title, []) if not m[1]]
            getters += [m for m in methods.get('is' + title, []) if m == ('boolean', ())]
            assert getters, prefix + ' requires a public getter'
            result = getters[0][0]
            assert ('void', (result,)) in methods.get('set' + title, []), (
                prefix + ' requires a public setter matching the getter type')
        else:
            invokers = methods.get(name, [])
            assert invokers, prefix + ' requires a public action invocation method'
            for result, params in invokers:
                assert len(params) <= 1, prefix + ' supports at most one action parameter'
                handlers = methods.get('do' + title, [])
                assert ((result, params) in handlers or
                        (result, params + ('Context',)) in handlers), (
                    prefix + ' requires a matching do-method, optionally with Context')
    return len(slots)

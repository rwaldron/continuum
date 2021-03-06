var runtime = (function(GLOBAL, exports, undefined){
  var esprima   = require('../third_party/esprima'),
      errors    = require('./errors'),
      utility   = require('./utility'),
      assemble  = require('./assembler').assemble,
      constants = require('./constants'),
      operators = require('./operators');

  operators.ToObject = ToObject;
  var Thunk = require('./thunk').Thunk;

  var Hash             = utility.Hash,
      Emitter          = utility.Emitter,
      PropertyList     = utility.PropertyList,
      create           = utility.create,
      numbers          = utility.numbers,
      isObject         = utility.isObject,
      nextTick         = utility.nextTick,
      enumerate        = utility.enumerate,
      ownKeys          = utility.keys,
      define           = utility.define,
      copy             = utility.copy,
      inherit          = utility.inherit,
      each             = utility.each,
      iterate          = utility.iterate,
      unique           = utility.unique;


  var ThrowException   = errors.ThrowException,
      MakeException    = errors.MakeException,
      Completion       = errors.Completion,
      AbruptCompletion = errors.AbruptCompletion;

  var GetValue         = operators.GetValue,
      PutValue         = operators.PutValue,
      GetThisValue     = operators.GetThisValue,
      ToPrimitive      = operators.ToPrimitive,
      ToBoolean        = operators.ToBoolean,
      ToNumber         = operators.ToNumber,
      ToInteger        = operators.ToInteger,
      ToUint32         = operators.ToUint32,
      ToInt32          = operators.ToInt32,
      ToUint16         = operators.ToUint16,
      ToString         = operators.ToString,
      UnaryOp          = operators.UnaryOp,
      BinaryOp         = operators.BinaryOp,
      ToPropertyName   = operators.ToPropertyName,
      IS               = operators.IS,
      EQUAL            = operators.EQUAL,
      STRICT_EQUAL     = operators.STRICT_EQUAL;


  var SYMBOLS       = constants.SYMBOLS,
      Break         = SYMBOLS.Break,
      Pause         = SYMBOLS.Pause,
      Throw         = SYMBOLS.Throw,
      Empty         = SYMBOLS.Empty,
      Return        = SYMBOLS.Return,
      Native        = SYMBOLS.Native,
      Continue      = SYMBOLS.Continue,
      Uninitialized = SYMBOLS.Uninitialized;

  var StopIteration = constants.BRANDS.StopIteration;
  var slice = [].slice;
  var uid = (Math.random() * (1 << 30)) | 0;

  var BINARYOPS = constants.BINARYOPS.array,
      UNARYOPS  = constants.UNARYOPS.array,
      BRANDS    = constants.BRANDS,
      ENTRY     = constants.ENTRY.hash,
      SCOPE     = constants.SCOPE.hash,
      AST       = constants.AST.array;

  var ARROW  = constants.FUNCTYPE.getIndex('ARROW'),
      METHOD = constants.FUNCTYPE.getIndex('METHOD'),
      NORMAL = constants.FUNCTYPE.getIndex('NORMAL');


  var ATTRS = constants.ATTRIBUTES,
      E = ATTRS.ENUMERABLE,
      C = ATTRS.CONFIGURABLE,
      W = ATTRS.WRITABLE,
      A = ATTRS.ACCESSOR,
      ___ = ATTRS.___,
      E__ = ATTRS.E__,
      _C_ = ATTRS._C_,
      EC_ = ATTRS.EC_,
      __W = ATTRS.__W,
      E_W = ATTRS.E_W,
      _CW = ATTRS._CW,
      ECW = ATTRS.ECW,
      __A = ATTRS.__A,
      E_A = ATTRS.E_A,
      _CA = ATTRS._CA,
      ECA = ATTRS.ECA;

  var BOOLEAN   = 'boolean',
      FUNCTION  = 'function',
      NUMBER    = 'number',
      OBJECT    = 'object',
      STRING    = 'string',
      UNDEFINED = 'undefined',
      ARGUMENTS = 'arguments';

  var GET          = 'Get',
      SET          = 'Set',
      VALUE        = 'Value',
      WRITABLE     = 'Writable',
      ENUMERABLE   = 'Enumerable',
      CONFIGURABLE = 'Configurable';


  errors.createError = function(name, type, message){
    return new $Error(name, type, message);
  };

  AbruptCompletion.prototype.Abrupt = SYMBOLS.Abrupt;
  Completion.prototype.Completion   = SYMBOLS.Completion;



  // ##################################################
  // ### Internal Utilities not from specification ####
  // ##################################################

  function noop(){}

  if (Object.getOwnPropertyNames) {
    var hide = function(o, k){
      Object.defineProperty(o, k, { enumerable: false });
    };
  } else {
    var hide = function(){};
  }

  function setDirect(o, key, value){
    if (o.properties.has(key)) {
      o.properties.set(key, value);
    } else {
      o.properties.set(key, value, ECW);
    }
  }


  // ###############################
  // ###############################
  // ### Specification Functions ###
  // ###############################
  // ###############################


  // ## FromPropertyDescriptor

  function FromPropertyDescriptor(desc){
    var obj = new $Object;
    if (IsDataDescriptor(desc)) {
      obj.set('value', desc.Value);
      obj.set('writable', desc.Writable);
    } else if (IsAccessorDescriptor(desc))  {
      obj.set('get', desc.Get);
      obj.set('set', desc.Set);
    }
    obj.set('enumerable', desc.Enumerable);
    obj.set('configurable', desc.Configurable);
    return obj;
  }


  // ## CheckObjectCoercible

  function CheckObjectCoercible(argument){
    if (argument === null) {
      return ThrowException('null_to_object');
    } else if (argument === undefined) {
      return ThrowException('undefined_to_object');
    } else if (typeof argument === OBJECT && argument.Completion) {
      if (argument.Abrupt) {
        return argument;
      }
      return CheckObjectCoercible(argument.value);
    } else {
      return argument;
    }
  }

  // ## ToPropertyDescriptor

  var descFields = ['value', 'writable', 'enumerable', 'configurable', 'get', 'set'];
  var descProps = [VALUE, WRITABLE, ENUMERABLE, CONFIGURABLE, GET, SET];
  var standardFields = create(null);

  each(descFields, function(field){
    standardFields[field] = true;
  });


  function ToPropertyDescriptor(obj) {
    if (obj && obj.Completion) {
      if (obj.Abrupt) return obj; else obj = obj.value;
    }

    if (typeof obj !== OBJECT) {
      return ThrowException('property_desc_object', [typeof obj]);
    }

    var desc = create(null);

    for (var i=0, v; i < 6; i++) {
      if (obj.HasProperty(descFields[i])) {
        v = obj.Get(descFields[i]);
        if (v && v.Completion) {
          if (v.Abrupt) return v; else v = v.value;
        }
        desc[descProps[i]] = v;
      }
    }

    if (desc.Get !== undefined) {
      if (!desc.Get || !desc.Get.Call) {
        return ThrowException('getter_must_be_callable', [typeof desc.Get]);
      }
    }

    if (desc.Set !== undefined) {
      if (!desc.Set || !desc.Set.Call) {
        return ThrowException('setter_must_be_callable', [typeof desc.Set]);
      }
    }

    if ((GET in desc || SET in desc) && (VALUE in desc || WRITABLE in desc))
      return ThrowException('value_and_accessor', [desc]);

    return desc;
  }

  function CopyAttributes(from, to){
    var props = from.Enumerate(true, false);
    for (var i=0; i < props.length; i++) {
      var field = props[i];
      if (!(field in standardFields)) {
        to.properties.set(field, from.Get(field), ECW);
      }
    }
  }
  // ## IsAccessorDescriptor

  function IsAccessorDescriptor(desc) {
    return desc === undefined ? false : GET in desc || SET in desc;
  }

  // ## IsDataDescriptor

  function IsDataDescriptor(desc) {
    return desc === undefined ? false : VALUE in desc || WRITABLE in desc;
  }

  // ## IsGenericDescriptor

  function IsGenericDescriptor(desc) {
    return desc === undefined ? false : !(IsAccessorDescriptor(desc) || IsDataDescriptor(desc));
  }

  function FromGenericPropertyDescriptor(desc){
    if (desc === undefined) return;
    var obj = new $Object;
    for (var i=0, v; i < 6; i++) {
      if (descProps[i] in desc) obj.set(descFields[i], desc[descProps[i]]);
    }
    return obj;
  }
  // ## ToCompletePropertyDescriptor

  function ToCompletePropertyDescriptor(obj) {
    var desc = ToPropertyDescriptor(obj);
    if (desc && desc.Completion) {
      if (desc.Abrupt) {
        return desc;
      } else {
        desc = desc.value;
      }
    }

    if (IsGenericDescriptor(desc) || IsDataDescriptor(desc)) {
      VALUE in desc    || (desc.Value = undefined);
      WRITABLE in desc || (desc.Writable = false);
    } else {
      GET in desc || (desc.Get = undefined);
      SET in desc || (desc.Set = undefined);
    }
    ENUMERABLE in desc   || (desc.Enumerable = false);
    CONFIGURABLE in desc || (desc.Configurable = false);
    return desc;
  }

  // ## IsEmptyDescriptor

  function IsEmptyDescriptor(desc) {
    return !(GET in desc
          || SET in desc
          || VALUE in desc
          || WRITABLE in desc
          || ENUMERABLE in desc
          || CONFIGURABLE in desc);
  }

  // ## IsEquivalentDescriptor

  function IsEquivalentDescriptor(a, b) {
    if (a && a.Completion) {
      if (a.Abrupt) return a; else a = a.value;
    }
    if (b && b.Completion) {
      if (b.Abrupt) return b; else b = b.value;
    }
    return IS(a.Get, b.Get) &&
           IS(a.Set, b.Set) &&
           IS(a.Value, b.Value) &&
           IS(a.Writable, b.Writable) &&
           IS(a.Enumerable, b.Enumerable) &&
           IS(a.Configurable, b.Configurable);
  }

  // ## IsCallable

  function IsCallable(argument){
    if (argument && typeof argument === OBJECT) {
      if (argument.Completion) {
        if (argument.Abrupt) {
          return argument;
        }
        return IsCallable(argument.value);
      }
      return 'Call' in argument;
    } else {
      return false;
    }
  }

  // ## IsConstructor

  function IsConstructor(argument){
    if (argument && typeof argument === OBJECT) {
      if (argument.Completion) {
        if (argument.Abrupt) {
          return argument;
        }
        return IsConstructor(argument.value);
      }
      return 'Construct' in argument;
    } else {
      return false;
    }
  }

  // ## MakeConstructor

  function MakeConstructor(func, writable, prototype){
    var install = prototype === undefined;
    if (install) {
      prototype = new $Object;
    }
    prototype.IsProto = true;
    if (writable === undefined) {
      writable = true;
    }
    if (install) {
      prototype.properties.set('constructor', func, writable ? _CW : ___);
    }
    func.properties.set('prototype', prototype, writable ? __W : ___);
  }

  // ## IsArrayIndex

  function IsArrayIndex(argument) {
    var n = +argument >>> 0;
    if ('' + n === argument && n !== 0xffffffff) {
      return true;
    }
    return false;
  }


  // ## Invoke
  function Invoke(key, receiver, args){
    var obj = ToObject(receiver);
    if (obj && obj.Completion) {
      if (obj.Abrupt) return obj; else obj = obj.value;
    }

    var func = obj.Get(key);
    if (func && func.Completion) {
      if (func.Abrupt) return func; else func = func.value;
    }

    if (!IsCallable(func))
      return ThrowException('called_non_callable', key);

    return func.Call(obj, args);
  }

  // ## GetIdentifierReference

  function GetIdentifierReference(lex, name, strict){
    if (lex == null) {
      return new Reference(undefined, name, strict);
    } else if (lex.HasBinding(name)) {
      return new Reference(lex, name, strict);
    } else {
      return GetIdentifierReference(lex.outer, name, strict);
    }
  }

  function GetSymbol(context, name){
    var env = context.LexicalEnvironment;
    while (env) {
      if (env.HasSymbolBinding(name)) {
        return env.GetSymbol(name);
      }
      env = env.outer;
    }
  }

  // ## IsPropertyReference

  function IsPropertyReference(v){
    var type = typeof v.base;
    return type === STRING
        || type === NUMBER
        || type === BOOLEAN
        || v.base instanceof $Object;
  }

  operators.IsPropertyReference = IsPropertyReference;

  // ## ToObject

  function ToObject(argument){
    switch (typeof argument) {
      case BOOLEAN:
        return new $Boolean(argument);
      case NUMBER:
        return new $Number(argument);
      case STRING:
        return new $String(argument);
      case UNDEFINED:
        return ThrowException('undefined_to_object', []);
      case OBJECT:
        if (argument === null) {
          return ThrowException('null_to_object', []);
        } else if (argument.Completion) {
          if (argument.Abrupt) {
            return argument;
          }
          return ToObject(argument.value);
        }
        return argument;
    }
  }


  function ThrowStopIteration(){
    return new AbruptCompletion('throw', intrinsics.StopIteration);
  }

  function IsStopIteration(o){
    return !!(o && o.Abrupt && o.value && o.value.NativeBrand === StopIteration);
  }


  var PropertyDefinitionEvaluation = (function(){
    function makeDefiner(constructs, field, desc){
      return function(obj, key, code) {

        var sup = code.NeedsSuperBinding,
            lex = context.LexicalEnvironment,
            home = sup ? obj : undefined,
            $F = code.generator ? $GeneratorFunction : $Function,
            func = new $F(METHOD, key, code.params, code, lex, code.Strict, undefined, home, sup);

        constructs && MakeConstructor(func);
        desc[field] = func;
        var result = obj.DefineOwnProperty(key, desc, false);
        desc[field] = undefined;

        return result && result.Abrupt ? result : func;
      };
    }

    var DefineMethod = makeDefiner(false, VALUE, {
      Value: undefined,
      Writable: true,
      Enumerable: true,
      Configurable: true
    });

    var DefineGetter = makeDefiner(true, GET, {
      Get: undefined,
      Enumerable: true,
      Configurable: true
    });

    var DefineSetter = makeDefiner(true, SET, {
      Set: undefined,
      Enumerable: true,
      Configurable: true
    });

    return function PropertyDefinitionEvaluation(kind, obj, key, code){
      if (kind === 'get') {
        return DefineGetter(obj, key, code);
      } else if (kind === 'set') {
        return DefineSetter(obj, key, code);
      } else if (kind === 'method') {
        return DefineMethod(obj, key, code);
      }
    };
  })();



  var mutable = {
    Value: undefined,
    Writable: true,
    Enumerable: true,
    Configurable: true
  };

  var immutable = {
    Value: undefined,
    Writable: true,
    Enumerable: true,
    Configurable: false
  };


  function TopLevelDeclarationInstantiation(code){
    var env = context.VariableEnvironment,
        configurable = code.ScopeType === SCOPE.EVAL,
        decls = code.LexicalDeclarations;

    var desc = configurable ? mutable : immutable;

    for (var i=0, decl; decl = decls[i]; i++) {
      if (decl.type === 'FunctionDeclaration') {
        var name = decl.id.name;
        if (env.HasBinding(name)) {
          env.CreateMutableBinding(name, configurable);
        } else if (env === realm.globalEnv) {
          var existing = global.GetOwnProperty(name);
          if (!existing) {
            global.DefineOwnProperty(name, desc, true);
          } else if (IsAccessorDescriptor(existing) || !existing.Writable && !existing.Enumerable) {
            return ThrowException('global invalid define');
          }
        }
        if (decl.type === 'FunctionDeclaration') {
          env.SetMutableBinding(name, InstantiateFunctionDeclaration(decl, context.LexicalEnvironment), code.Strict);
        }
      }
    }

    for (var i=0; i < code.VarDeclaredNames.length; i++) {
      var name = code.VarDeclaredNames[i];
      if (!env.HasBinding(name)) {
        env.CreateMutableBinding(name, configurable);
        env.SetMutableBinding(name, undefined, code.Strict);
      } else if (env === realm.globalEnv) {
        var existing = global.GetOwnProperty(name);
        if (!existing) {
          global.DefineOwnProperty(name, desc, true);
        }
      }
    }
  }


  // ## FunctionDeclarationInstantiation

  function FunctionDeclarationInstantiation(func, args, env){
    var formals = func.FormalParameters,
        params = formals.BoundNames;

    for (var i=0; i < params.length; i++) {
      if (!env.HasBinding(params[i])) {
        env.CreateMutableBinding(params[i]);
        env.InitializeBinding(params[i], undefined);
      }
    }

    var decls = func.Code.LexicalDeclarations;

    for (var i=0, decl; decl = decls[i]; i++) {
      var names = decl.BoundNames;
      for (var j=0; j < names.length; j++) {
        if (!env.HasBinding(names[j])) {
          if (decl.IsConstantDeclaration) {
            env.CreateImmutableBinding(names[j]);
          } else {
            env.CreateMutableBinding(names[j], false);
          }
        }
      }
    }

    if (func.Strict) {
      var ao = new $StrictArguments(args);
      var status = ArgumentBindingInitialization(formals, ao, env);
    } else {
      var ao = env.arguments = new $MappedArguments(params, env, args, func);
      var status = ArgumentBindingInitialization(formals, ao);
    }

    if (status && status.Abrupt) {
      return status;
    }

    if (!env.HasBinding(ARGUMENTS)) {
      if (func.Strict) {
        env.CreateImmutableBinding(ARGUMENTS);
      } else {
        env.CreateMutableBinding(ARGUMENTS);
      }
      env.InitializeBinding(ARGUMENTS, ao);
    }


    var vardecls = func.Code.VarDeclaredNames;
    for (var i=0; i < vardecls.length; i++) {
      if (!env.HasBinding(vardecls[i])) {
        env.CreateMutableBinding(vardecls[i]);
        env.InitializeBinding(vardecls[i], undefined);
      }
    }

    var funcs = create(null);

    for (var i=0; i < decls.length; i++) {
      if (decls[i].type === 'FunctionDeclaration') {
        var decl = decls[i],
            name = decl.id.name;

        if (!(name in funcs)) {
          funcs[name] = true;
          env.InitializeBinding(name, InstantiateFunctionDeclaration(decl, env));
        }
      }
    }
  }

  function Brand(name){
    this.name = name;
  }

  // ## ClassDefinitionEvaluation

  function ClassDefinitionEvaluation(name, superclass, constructor, methods){
    if (superclass === undefined) {
      var superproto = intrinsics.ObjectProto,
          superctor = intrinsics.FunctionProto;
    } else {
      if (superclass && superclass.Completion) {
        if (superclass.Abrupt) {
          return superclass;
        } else {
          superclass = superclass.value;
        }
      }

      if (superclass === null) {
        superproto = null;
        superctor = intrinsics.FunctionProto;
      } else if (typeof superclass !== 'object') {
        return ThrowException('non_object_superclass');
      } else if (!('Construct' in superclass)) {
        superproto = superclass;
        superctor = intrinsics.FunctionProto;
      } else {
        superproto = superclass.Get('prototype');
        if (superproto && superproto.Completion) {
          if (superproto.Abrupt) {
            return superproto;
          } else {
            superproto = superproto.value;
          }
        }

        if (typeof superproto !== 'object') {
          return ThrowException('non_object_superproto');
        }
        superctor = superclass;
      }
    }

    var proto = new $Object(superproto),
        lex = context.LexicalEnvironment,
        brand = name || '';

    if (name) {
      var scope = context.LexicalEnvironment = new DeclarativeEnvironmentRecord(lex);
      scope.CreateImmutableBinding(name);
    }

    constructor || (constructor = intrinsics.EmptyClass.Code);

    var ctor = PropertyDefinitionEvaluation('method', proto, 'constructor', constructor);
    if (ctor && ctor.Completion) {
      if (ctor.Abrupt) return ctor; else ctor = ctor.value;
    }

    if (name) {
      scope.InitializeBinding(name, ctor);
    }

    ctor.setPrototype(superctor);
    ctor.set('name', brand);
    MakeConstructor(ctor, false, proto);
    proto.define('constructor', ctor, _CW);
    ctor.define('prototype', proto, ___);

    for (var i=0, method; method = methods[i]; i++) {
      PropertyDefinitionEvaluation(method.kind, proto, method.name, method.code);
    }

    ctor.Class = true;
    proto.Brand = new Brand(brand);
    proto.IsClassProto = true;
    context.LexicalEnvironment = lex;
    return ctor;
  }

  // ## InstantiateFunctionDeclaration

  function InstantiateFunctionDeclaration(decl, env){
    var code = decl.Code;
    var $F = code.generator ? $GeneratorFunction : $Function;
    var func = new $F(NORMAL, decl.id.name, code.params, code, env, code.Strict);
    MakeConstructor(func);
    return func;
  }


  // ## BlockDeclarationInstantiation

  function BlockDeclarationInstantiation(decls, env){
    for (var i=0, decl; decl = decls[i]; i++) {
      for (var j=0, name; name = decl.BoundNames[j]; j++) {
        if (decl.IsConstantDeclaration) {
          env.CreateImmutableBinding(name);
        } else {
          env.CreateMutableBinding(name, false);
        }
      }
    }

    for (i=0, decl; decl = decls[i]; i++) {
      if (decl.type === 'FunctionDeclaration') {
        env.InitializeBinding(decl.id.name, InstantiateFunctionDeclaration(decl, env));
      }
    }
  }



  // ## IdentifierResolution

  function IdentifierResolution(context, name) {
    return GetIdentifierReference(context.LexicalEnvironment, name, context.strict);
  }

  // ## BindingInitialization

  function BindingInitialization(pattern, value, env){
    if (pattern.type === 'Identifier') {
      if (env) {
        env.InitializeBinding(pattern.name, value);
      } else {
        return PutValue(IdentifierResolution(context, pattern.name), value);
      }
    } else if (pattern.type === 'ArrayPattern') {
      return IndexedBindingInitialization(pattern, value, 0, env);
    } else if (pattern.type === 'ObjectPattern') {
      return ObjectBindingInitialization(pattern, value, env);
    }
  }

  // ## ArgumentBindingInitialization

  function ArgumentBindingInitialization(params, args, env){
    for (var i = 0, arg; arg = params[i]; i++) {
      var value = args.HasProperty(i) ? args.Get(i) : undefined;
      if (value && value.Completion) {
        if (value.Abrupt) {
          return value;
        } else {
          value = value.value;
        }
      }
      BindingInitialization(arg, value, env);
    }
    if (params.Rest) {
      var len = args.get('length') - params.length,
          array = new $Array(0);

      if (len > 0) {
        for (var i=0; i < len; i++) {
          array.define(i, args.get(params.length + i));
        }
        array.set('length', len);
      }
      BindingInitialization(params.Rest, array, env);
    }
  }


  // ## IndexedBindingInitialization

  function IndexedBindingInitialization(pattern, array, i, env){
    for (var element; element = pattern.elements[i]; i++) {
      if (element.type === 'SpreadElement') {
        var value = context.destructureSpread(array, i);
        if (value.Abrupt) {
          return value;
        }
        return BindingInitialization(element.argument, value, env);
      }

      var value = array.HasProperty(i) ? array.Get(i) : undefined;
      if (value && value.Completion) {
        if (value.Abrupt) {
          return value;
        } else {
          value = value.value;
        }
      }
      BindingInitialization(element, value, env);
    }
    return i;
  }

  // ## ObjectBindingInitialization

  function ObjectBindingInitialization(pattern, object, env){
    for (var i=0; property = pattern.properties[i]; i++) {
      var value = object.HasProperty(property.key.name) ? object.Get(property.key.name) : undefined;
      if (value && value.Completion) {
        if (value.Abrupt) {
          return value;
        } else {
          value = value.value;
        }
      }
      BindingInitialization(property.value, value, env);
    }
  }




  function CollectionInitializer(Data, name){
    var data = name + 'Data';
    return function(object, iterable){
      object[data] = new Data;

      if (iterable === undefined) {
        return object;
      }

      iterable = ToObject(iterable);
      if (iterable && iterable.Completion) {
        if (iterable.Abrupt) {
          return iterable;
        } else {
          iterable = iterable.value;
        }
      }

      var iterator = Invoke('iterator', iterable);

      var adder = object.Get('set');
      if (adder && adder.Completion) {
        if (adder.Abrupt) {
          return adder;
        } else {
          adder = adder.value;
        }
      }

      if (!IsCallable(adder)) {
        return ThrowException('called_on_incompatible_object', [name + '.prototype.set']);
      }

      var next;
      while (next = Invoke('next', iterator)) {
        if (IsStopIteration(next)) {
          return object;
        }

        if (next && next.Completion) {
          if (next.Abrupt) return next; else next = next.value;
        }

        next = ToObject(next);

        var k = next.Get(0);
        if (k && k.Completion) {
          if (k.Abrupt) return k; else k = k.value;
        }

        var v = next.Get(1);
        if (v && v.Completion) {
          if (v.Abrupt) return v; else v = v.value;
        }

        var status = adder.Call(object, [k, v]);
        if (status && status.Abrupt) {
          return status;
        }
      }
    }

    return object;
  }


  var MapData = (function(){
    function LinkedItem(key, next){
      this.key = key;
      this.next = next;
      this.previous = next.previous;
      next.previous = next.previous.next = this;
    }

    define(LinkedItem.prototype, [
      function setNext(item){
        this.next = item;
        item.previous = this;
      },
      function setPrevious(item){
        this.previous = item;
        item.next = this;
      },
      function unlink(){
        this.next.previous = this.previous;
        this.previous.next = this.next;
        this.next = this.previous = this.data = this.key = null;
        return this.data;
      }
    ]);


    function MapData(){
      this.id = uid++ + '';
      this.size = 0;
      this.strings = create(null);
      this.numbers = create(null);
      this.others = create(null);
      this.guard = create(LinkedItem.prototype);
      this.guard.next = this.guard.previous = this.guard;
      this.guard.key = {};
      this.lastLookup = this.guard;
    }

    MapData.sigil = create(null);

    define(MapData.prototype, [
      function add(key){
        this.size++;
        return new LinkedItem(key, this.guard);
      },
      function lookup(key){
        var type = typeof key;
        if (key === this) {
          return this.guard;
        } else if (key !== null && type === OBJECT) {
          return key.storage[this.id];
        } else {
          return this.getStorage(key)[key];
        }
      },
      function getStorage(key){
        var type = typeof key;
        if (type === STRING) {
          return this.strings;
        } else if (type === NUMBER) {
          return key === 0 && 1 / key === -Infinity ? this.others : this.numbers;
        } else {
          return this.others;
        }
      },
      function set(key, value){
        var type = typeof key;
        if (key !== null && type === OBJECT) {
          var item = key.storage[this.id] || (key.storage[this.id] = this.add(key));
          item.value = value;
        } else {
          var container = this.getStorage(key);
          var item = container[key] || (container[key] = this.add(key));
          item.value = value;
        }
      },
      function get(key){
        var item = this.lookup(key);
        if (item) {
          return item.value;
        }
      },
      function has(key){
        return !!this.lookup(key);
      },
      function remove(key){
        var item;
        if (key !== null && typeof key === OBJECT) {
          item = key.storage[this.id];
          if (item) {
            delete key.storage[this.id];
          }
        } else {
          var container = this.getStorage(key);
          item = container[key];
          if (item) {
            delete container[key];
          }
        }

        if (item) {
          item.unlink();
          this.size--;
          return true;
        }
        return false;
      },
      function after(key){
        if (key === MapData.sigil) {
          var item = this.guard;
        } else if (key === this.lastLookup.key) {
          var item = this.lastLookup;
        } else {
          var item = this.lookup(key);
        }
        if (item && item.next !== this.guard) {
          this.lastLookup = item.next;
          return [item.next.key, item.next.value];
        } else {
          return ThrowStopIteration();
        }
      }
    ]);

    return MapData;
  })();


  var WeakMapData = (function(){
    function WeakMapData(){
      this.id = uid++ + '';
    }

    define(WeakMapData.prototype, [
      function set(key, value){
        if (value === undefined) {
          value = Empty;
        }
        key.storage[this.id] = value;
      },
      function get(key){
        var value = key.storage[this.id];
        if (value !== Empty) {
          return value;
        }
      },
      function has(key){
        return key.storage[this.id] !== undefined;
      },
      function remove(key){
        var item = key.storage[this.id];
        if (item !== undefined) {
          key.storage[this.id] = undefined;
          return true;
        }
        return false;
      }
    ]);

    return WeakMapData;
  })();


  function Element(context, prop, base){
    var result = CheckObjectCoercible(base);
    if (result.Abrupt) {
      return result;
    }

    var name = ToPropertyName(prop);
    if (name && name.Completion) {
      if (name.Abrupt) return name; else name = name.value;
    }

    return new Reference(base, name, context.Strict);
  }

  function SuperReference(context, prop){
    var env = context.getThisEnvironment();
    if (!env.HasSuperBinding()) {
      return ThrowException('invalid_super_binding');
    } else if (prop === null) {
      return env;
    }

    var baseValue = env.GetSuperBase(),
        status = CheckObjectCoercible(baseValue);

    if (status.Abrupt) {
      return status;
    }

    if (prop === false) {
      var key = env.GetMethodName();
    } else {
      var key = ToPropertyName(prop);
      if (key && key.Completion) {
        if (key.Abrupt) return key; else return key.value;
      }
    }

    var ref = new Reference(baseValue, key, context.Strict);
    ref.thisValue = env.GetThisBinding();
    return ref;
  }

  function GetThisEnvironment(context){
    var env = context.LexicalEnvironment;
    while (env) {
      if (env.HasThisBinding())
        return env;
      env = env.outer;
    }
  }


  function ThisResolution(context){
    return GetThisEnvironment(context).GetThisBinding();
  }

  function EvaluateConstruct(func, args) {
    if (typeof func !== OBJECT) {
      return ThrowException('not_constructor', func);
    }

    if ('Construct' in func) {
      return func.Construct(args);
    } else {
      return ThrowException('not_constructor', func);
    }
  }

  function EvaluateCall(ref, func, args){
    if (typeof func !== OBJECT || !IsCallable(func)) {
      return ThrowException('called_non_callable', [ref && ref.name]);
    }

    if (ref instanceof Reference) {
      var receiver = IsPropertyReference(ref) ? GetThisValue(ref) : ref.base.WithBaseObject();
    }

    return func.Call(receiver, args);
  }

  function SpreadArguments(precedingArgs, spread){
    if (typeof spread !== 'object') {
      return ThrowException('spread_non_object');
    }

    var offset = precedingArgs.length,
        len = ToUint32(spread.Get('length'));

    if (len && len.Completion) {
      if (len.Abrupt) return len; else return len.value;
    }

    for (var i=0; i < len; i++) {
      var value = spread.Get(i);
      if (value && value.Completion) {
        if (value.Abrupt) return value; else value = value.value;
      }

      precedingArgs[i + offset] = value;
    }
  }

  function SpreadInitialization(array, offset, spread){
    if (typeof spread !== 'object') {
      return ThrowException('spread_non_object');
    }

    var value, iterator = spread.Iterate();

    while (!(value = Invoke('next', iterator, [])) && !IsStopIteration(value)) {
      if (value && value.Completion) {
        if (value.Abrupt) return value; else value = value.value;
      }
      array.define(offset++, value, ECW);
    }

    array.define('length', offset, _CW);
    return offset;
  }

  function GetTemplateCallSite(context, template){
    if (!('id' in template)) {
      GetTemplateCallSite.count = (GetTemplateCallSite.count || 0) + 1;
      template.id = GetTemplateCallSite.count;
    }
    if (template.id in realm.templates) {
      return context.Realm.templates[template.id];
    }

    var count = template.length,
        site = context.createArray(count),
        raw = context.createArray(count);

    for (var i=0; i < count; i++) {
      site.define(i+'', template[i].cooked, E__);
      raw.define(i+'', template[i].raw, E__);
    }
    site.define('length', count, ___);
    raw.define('length', count, ___);
    site.define('raw', raw, ___);
    site.setExtensible(false);
    raw.setExtensible(false);
    realm.templates[template.id] = site;
    return site;
  }

  function SpreadDestructuring(context, target, index){
    var array = context.createArray(0);
    if (target == null) {
      return array;
    }
    if (typeof target !== 'object') {
      return ThrowException('spread_non_object', typeof target);
    }

    var len = ToUint32(target.Get('length'));
    if (len && len.Completion) {
      if (len.Abrupt) return len; else len = len.value;
    }

    var count = len - index;
    for (var i=0; i < count; i++) {
      var value = target.Get(index + i);
      if (value && value.Completion) {
        if (value.Abrupt) return value; else value = value.value;
      }
      array.define(i, value, ECW);
    }

    array.define('length', i, _CW);
    return array;
  }


  // ###########################
  // ###########################
  // ### Specification Types ###
  // ###########################
  // ###########################


  // #################
  // ### Reference ###
  // #################


  var Reference = (function(){
    function Reference(base, name, strict){
      this.base = base;
      this.name = name;
      this.strict = strict;
    }
    define(Reference.prototype, {
      Reference: SYMBOLS.Reference
    });

    return Reference;
  })();






  // ##########################
  // ### PropertyDescriptor ###
  // ##########################

  function PropertyDescriptor(attributes){
    this.Enumerable = (attributes & E) > 0;
    this.Configurable = (attributes & C) > 0;
  }

  define(PropertyDescriptor.prototype, {
    Enumerable: undefined,
    Configurable: undefined
  });

  function DataDescriptor(value, attributes){
    this.Value = value;
    this.Writable = (attributes & W) > 0;
    this.Enumerable = (attributes & E) > 0;
    this.Configurable = (attributes & C) > 0;
  }

  inherit(DataDescriptor, PropertyDescriptor, {
    Writable: undefined,
    Value: undefined
  });

  function AccessorDescriptor(accessors, attributes){
    this.Get = accessors.Get;
    this.Set = accessors.Set;
    this.Enumerable = (attributes & E) > 0;
    this.Configurable = (attributes & C) > 0;
  }

  inherit(AccessorDescriptor, PropertyDescriptor, {
    Get: undefined,
    Set: undefined
  });

  function NormalDescriptor(value){
    this.Value = value;
  }

  var emptyValue = NormalDescriptor.prototype = new DataDescriptor(undefined, ECW);

  function StringIndice(value){
    this.Value = value;
  }

  StringIndice.prototype = new DataDescriptor(undefined, E__);


  function Value(value){
    this.Value = value;
  }



  function Accessor(get, set){
    this.Get = get;
    this.Set = set;
  }

  define(Accessor.prototype, {
    Get: undefined,
    Set: undefined
  });




  function ArgAccessor(name, env){
    this.name = name;
    define(this, { env: env  });
  }

  inherit(ArgAccessor, Accessor, {
    Get: { Call: function(){ return this.env.GetBindingValue(this.name) } },
    Set: { Call: function(v){ this.env.SetMutableBinding(this.name, v) } }
  });



  // #########################
  // ### EnvironmentRecord ###
  // #########################

  var EnvironmentRecord = (function(){
    function EnvironmentRecord(bindings, outer){
      this.bindings = bindings;
      this.outer = outer;
    }

    define(EnvironmentRecord.prototype, {
      bindings: null,
      withBase: undefined,
      type: 'Environment',
      Environment: true
    });

    define(EnvironmentRecord.prototype, [
      function EnumerateBindings(){},
      function HasBinding(name){},
      function GetBindingValue(name, strict){},
      function SetMutableBinding(name, value, strict){},
      function DeleteBinding(name){},
      function WithBaseObject(){
        return this.withBase;
      },
      function HasThisBinding(){
        return false;
      },
      function HasSuperBinding(){
        return false;
      },
      function GetThisBinding(){},
      function GetSuperBase(){},
      function HasSymbolBinding(name){
        if (this.symbols) {
          return name in this.symbols;
        }
        return false;
      },
      function InitializeSymbolBinding(name, symbol){
        if (!this.symbols) {
          this.symbols = create(null);
        }
        if (name in this.symbols) {
          return ThrowException('symbol_redefine', name);
        }
        this.symbols[name] = symbol;
      },
      function GetSymbol(name){
        if (this.symbols && name in this.symbols) {
          return this.symbols[name];
        } else{
          return ThrowException('symbol_not_defined', name);
        }
      },
      function reference(name, strict){
        return new Reference(this, name, strict);
      }
    ]);

    return EnvironmentRecord;
  })();

  var DeclarativeEnvironmentRecord = (function(){
    function DeclarativeEnvironmentRecord(outer){
      EnvironmentRecord.call(this, new Hash, outer);
      this.consts = new Hash;
      this.deletables = new Hash;
    }

    inherit(DeclarativeEnvironmentRecord, EnvironmentRecord, {
      type: 'Declarative Env'
    }, [
      function EnumerateBindings(){
        return ownKeys(this.bindings);
      },
      function HasBinding(name){
        return name in this.bindings;
      },
      function CreateMutableBinding(name, deletable){
        this.bindings[name] = undefined;
        if (deletable)
          this.deletables[name] = true;
      },
      function InitializeBinding(name, value){
        this.bindings[name] = value;
      },
      function GetBindingValue(name, strict){
        if (name in this.bindings) {
          var value = this.bindings[name];
          if (value === Uninitialized)
            return ThrowException('uninitialized_const', name);
          else
            return value;
        } else if (strict) {
          return ThrowException('not_defined', name);
        } else {
          return false;
        }
      },
      function SetMutableBinding(name, value, strict){
        if (name in this.consts) {
          if (this.bindings[name] === Uninitialized)
            return ThrowException('uninitialized_const', name);
          else if (strict)
            return ThrowException('const_assign', name);
        } else {
          this.bindings[name] = value;
        }
      },
      function CreateImmutableBinding(name){
        this.bindings[name] = Uninitialized;
        this.consts[name] = true;
      },
      function DeleteBinding(name){
        if (name in this.bindings) {
          if (name in this.deletables) {
            delete this.bindings[name];
            delete this.deletables[names];
            return true;
          } else {
            return false;
          }
        } else {
          return true;
        }
      }
    ]);

    return DeclarativeEnvironmentRecord;
  })();


  var ObjectEnvironmentRecord = (function(){
    function ObjectEnvironmentRecord(object, outer){
      EnvironmentRecord.call(this, object, outer);
    }

    inherit(ObjectEnvironmentRecord, EnvironmentRecord, {
      type: 'Object Env'
    }, [
      function EnumerateBindings(){
        return this.bindings.Enumerate(false, false);
      },
      function HasBinding(name){
        return this.bindings.HasProperty(name);
      },
      function CreateMutableBinding(name, deletable){
        return this.bindings.DefineOwnProperty(name, emptyValue, true);
      },
      function InitializeBinding(name, value){
        return this.bindings.DefineOwnProperty(name, new NormalDescriptor(value), true);
      },
      function GetBindingValue(name, strict){
        if (this.bindings.HasProperty(name)) {
          return this.bindings.Get(name);
        } else if (strict) {
          return ThrowException('not_defined', name);
        }
      },
      function SetMutableBinding(name, value, strict){
        return this.bindings.Put(name, value, strict);
      },
      function DeleteBinding(name){
       return this.bindings.Delete(name, false);
      }
    ]);

    return ObjectEnvironmentRecord;
  })();



  var FunctionEnvironmentRecord = (function(){
    function FunctionEnvironmentRecord(receiver, method){
      DeclarativeEnvironmentRecord.call(this, method.Scope);
      this.thisValue = receiver;
      this.HomeObject = method.HomeObject;
      this.MethodName = method.MethodName;
    }

    inherit(FunctionEnvironmentRecord, DeclarativeEnvironmentRecord, {
      HomeObject: undefined,
      MethodName: undefined,
      thisValue: undefined,
      type: 'Function Env'
    }, [
      function HasThisBinding(){
        return true;
      },
      function HasSuperBinding(){
        return this.HomeObject !== undefined;
      },
      function GetThisBinding(){
        return this.thisValue;
      },
      function GetSuperBase(){
        return this.HomeObject ? this.HomeObject.getPrototype() : undefined;
      },
      function GetMethodName() {
        return this.MethodName;
      }
    ]);

    return FunctionEnvironmentRecord;
  })();



  var GlobalEnvironmentRecord = (function(){
    function GlobalEnvironmentRecord(global){
      ObjectEnvironmentRecord.call(this, global);
      this.thisValue = this.bindings;
      global.env = this;
      hide(global, 'env');
    }

    inherit(GlobalEnvironmentRecord, ObjectEnvironmentRecord, {
      outer: null,
      type: 'Global Env'
    }, [
      function GetThisBinding(){
        return this.bindings;
      },
      function HasThisBinding(){
        return true;
      },
      function inspect(){
        return '[GlobalEnvironmentRecord]';
      }
    ]);

    return GlobalEnvironmentRecord;
  })();



  // ###############
  // ### $Object ###
  // ###############

  var $Object = (function(){
    var Proto = {
      Get: {
        Call: function(receiver){
          return receiver.getPrototype();
        }
      },
      Set: {
        Call: function(receiver, args){
          return receiver.setPrototype(args[0]);
        }
      }
    };

    function $Object(proto){
      if (proto === undefined) {
        proto = intrinsics.ObjectProto;
      }
      this.Prototype = proto;
      this.properties = new PropertyList;
      this.hiddens = create(null);
      this.storage = create(null);
      $Object.tag(this);
      if (proto === null) {
        this.properties.setProperty(['__proto__', null, 6, Proto]);
      }

      this.Realm = realm;
      hide(this, 'hiddens');
      hide(this, 'storage');
      hide(this, 'Prototype');
      hide(this, 'Realm');
    }

    var counter = 0;
    define($Object, function tag(object){
      if (object.id === undefined) {
        object.id = counter++;
        hide(object, 'id');
      }
    });

    define($Object.prototype, {
      Extensible: true,
      NativeBrand: BRANDS.NativeObject
    });

    define($Object.prototype, [
      function has(key){
        return this.properties.has(key);
      },
      function remove(key){
        return this.properties.remove(key);
      },
      function describe(key){
        return this.properties.getProperty(key);
      },
      function define(key, value, attrs){
        return this.properties.set(key, value, attrs);
      },
      function get(key){
        return this.properties.get(key);
      },
      function set(key, value){
        if (this.properties.has(key)) {
          this.properties.set(key, value);
        } else {
          this.properties.set(key, value, ECW);
        }
      },
      function query(key){
        return this.properties.getAttribute(key);
      },
      function update(key, attr){
        this.properties.setAttribute(key, attr);
      },
      function each(callback){
        this.properties.forEach(callback, this);
      },
      function getPrototype(){
        return this.Prototype;
      },
      function setPrototype(value){
        if (typeof value === 'object' && this.getExtensible()) {
          this.Prototype = value;
          return true;
        } else {
          return false;
        }
      },
      function getExtensible(){
        return this.Extensible;
      },
      function setExtensible(v){
        v = !!v;
        if (this.Extensible) {
          this.Extensible = v;
        }
        return this.Extensible === v;
      },
      function GetOwnProperty(key){
        if (key === '__proto__') {
          var val = this.GetP(this, '__proto__');
          return typeof val === OBJECT ? new DataDescriptor(val, 6) : undefined;
        }

        var prop = this.describe(key);
        if (prop) {
          if (prop[2] & A) {
            var Descriptor = AccessorDescriptor,
                val = prop[1];
          } else {
            var val = prop[3] ? prop[3](this) : prop[1],
                Descriptor = DataDescriptor;
          }
          return new Descriptor(val, prop[2]);
        }
      },
      function GetProperty(key){
        var desc = this.GetOwnProperty(key);
        if (desc) {
          return desc;
        } else {
          var proto = this.getPrototype();
          if (proto) {
            return proto.GetProperty(key);
          }
        }
      },
      function Get(key){
        return this.GetP(this, key);
      },
      function Put(key, value, strict){
        if (!this.SetP(this, key, value) && strict) {
          return ThrowException('strict_cannot_assign', [key]);
        }
      },
      function GetP(receiver, key){
        var prop = this.describe(key);
        if (!prop) {
          var proto = this.getPrototype();
          if (proto) {
            return proto.GetP(receiver, key);
          }
        } else if (prop[3]) {
          var getter = prop[3].Get;
          return getter.Call(receiver, [key]);
        } else if (prop[2] & A) {
          var getter = prop[1].Get;
          if (IsCallable(getter)) {
            return getter.Call(receiver, []);
          }
        } else {
          return prop[1];
        }
      },
      function SetP(receiver, key, value) {
        var prop = this.describe(key);
        if (prop) {
          if (prop[3]) {
            var setter = prop[3].Set;
            setter.Call(receiver, [key, value]);
            return true;
          } else if (prop[2] & A) {
            var setter = prop[1].Set;
            if (IsCallable(setter)) {
              setter.Call(receiver, [value]);
              return true;
            } else {
              return false;
            }
          } else if (prop[2] & W) {
            if (this === receiver) {
              return this.DefineOwnProperty(key, new Value(value), false);
            } else if (!receiver.getExtensible()) {
              return false;
            } else {
              return receiver.DefineOwnProperty(key, new DataDescriptor(value, ECW), false);
            }
          } else {
            return false;
          }
        } else {
          var proto = this.getPrototype();
          if (!proto) {
            if (!receiver.getExtensible()) {
              return false;
            } else {
              return receiver.DefineOwnProperty(key, new DataDescriptor(value, ECW), false);
            }
          } else {
            return proto.SetP(receiver, key, value);
          }
        }
      },
      function DefineOwnProperty(key, desc, strict){
        var reject = strict
            ? function(e, a){ return ThrowException(e, a) }
            : function(e, a){ return false };

        var current = this.GetOwnProperty(key);

        if (current === undefined) {
          if (!this.getExtensible()) {
            return reject('define_disallowed', []);
          } else {
            if (IsGenericDescriptor(desc) || IsDataDescriptor(desc)) {
              this.define(key, desc.Value, desc.Enumerable | (desc.Configurable << 1) | (desc.Writable << 2));
            } else {
              this.define(key, new Accessor(desc.Get, desc.Set), desc.Enumerable | (desc.Configurable << 1) | A);
            }
            return true;
          }
        } else {
          var rejected = false;
          if (IsEmptyDescriptor(desc) || IsEquivalentDescriptor(desc, current)) {
            return;
          }

          if (!current.Configurable) {
            if (desc.Configurable || desc.Enumerable === !current.Configurable) {
              return reject('redefine_disallowed', []);
            } else {
              var currentIsData = IsDataDescriptor(current),
                  descIsData = IsDataDescriptor(desc);

              if (currentIsData !== descIsData)
                return reject('redefine_disallowed', []);
              else if (currentIsData && descIsData)
                if (!current.Writable && VALUE in desc && desc.Value !== current.Value)
                  return reject('redefine_disallowed', []);
              else if (SET in desc && desc.Set !== current.Set)
                return reject('redefine_disallowed', []);
              else if (GET in desc && desc.Get !== current.Get)
                return reject('redefine_disallowed', []);
            }
          }

          CONFIGURABLE in desc || (desc.Configurable = current.Configurable);
          ENUMERABLE in desc || (desc.Enumerable = current.Enumerable);

          var prop = this.describe(key);

          if (IsAccessorDescriptor(desc)) {
            prop[2] = desc.Enumerable | (desc.Configurable << 1) | A;
            if (IsDataDescriptor(current)) {
              prop[1] = new Accessor(desc.Get, desc.Set);
            } else {
              if (SET in desc) {
                prop[1].Set = desc.Set;
              }
              if (GET in desc) {
                prop[1].Get = desc.Get;
              }
            }
          } else {
            if (IsAccessorDescriptor(current)) {
              current.Writable = true;
            }
            WRITABLE in desc || (desc.Writable = current.Writable);
            if ('Value' in desc) {
              prop[1] = desc.Value;
            }
            prop[2] = desc.Enumerable | (desc.Configurable << 1) | (desc.Writable << 2);
          }

          return true;
        }
      },
      function HasOwnProperty(key){
        return this.has(key);
      },
      function HasProperty(key){
        if (this.has(key)) {
          return true;
        } else {
          var proto = this.getPrototype();
          if (proto) {
            return proto.HasProperty(key);
          } else {
            return false;
          }
        }
      },
      function Delete(key, strict){
        if (!this.has(key)) {
          return true;
        } else if (this.describe(key)[2] & C) {
          this.remove(key);
          return true;
        } else if (strict) {
          return ThrowException('strict_delete', []);
        } else {
          return false;
        }
      },
      function Iterate(){
        return Invoke(intrinsics.iterator, this, []);
      },
      function enumerator(){
        var keys = this.Enumerate(true, true),
            index = 0,
            len = keys.length;

        var iterator = new $Object;
        iterator.set('next', new $NativeFunction({
          length: 0,
          name: 'next',
          call: function next(){
            if (index < len) {
              return keys[index++];
            } else {
              return ThrowStopIteration();
            }
          }
        }));
        return iterator;
      },
      function Enumerate(includePrototype, onlyEnumerable){
        var props = [],
            seen = create(null);

        this.each(function(prop){
          if (!(prop[0] in seen) && !prop[0].Private && !onlyEnumerable || (prop[2] & E)) {
            props.push(prop[0]);
            seen[prop[0]] = true;
          }
        });

        if (includePrototype) {
          var proto = this.getPrototype();
          if (proto) {
            var inherited = proto.Enumerate(includePrototype, onlyEnumerable);
            for (var i=0; i < inherited.length; i++) {
              if (!(inherited[i] in seen)) {
                props.push(inherited[i]);
                seen[inherited[i]] = true;
              }
            }
          }
        }

        return props;
      },
      function DefaultValue(hint){
        var order = hint === 'String' ? ['toString', 'valueOf'] : ['valueOf', 'toString'];

        for (var i=0; i < 2; i++) {
          var method = this.Get(order[i]);
          if (method && method.Completion) {
            if (method.Abrupt) return method; else method = method.value;
          }

          if (IsCallable(method)) {
            var value = method.Call(this, []);
            if (value && value.Completion) {
              if (value.Abrupt) return value; else value = value.value;
            }
            if (value === null || typeof value !== OBJECT) {
              return value;
            }
          }
        }

        return ThrowException('cannot_convert_to_primitive', []);
      }
    ]);

    return $Object;
  })();



  var DefineOwn = $Object.prototype.DefineOwnProperty;

  // #################
  // ### $Function ###
  // #################

  var $Function = (function(){
    function $Function(kind, name, params, code, scope, strict, proto, holder, method){
      if (proto === undefined)
        proto = intrinsics.FunctionProto;

      $Object.call(this, proto);
      this.FormalParameters = params;
      this.ThisMode = kind === ARROW ? 'lexical' : strict ? 'strict' : 'global';
      this.Strict = !!strict;
      this.Realm = realm;
      this.Scope = scope;
      this.Code = code;
      if (holder !== undefined) {
        this.HomeObject = holder;
      }
      if (method) {
        this.MethodName = name;
      }

      var len = params ? params.ExpectedArgumentCount : 0;
      var nameAttrs = code.name && !code.writableName ? ___ : __W;
      name = code.name || '';

      if (strict) {
        this.properties.initialize([
          'arguments', intrinsics.ThrowTypeError, __A,
          'caller', intrinsics.ThrowTypeError, __A,
          'length', len, ___,
          'name', name, nameAttrs
        ]);
      } else {
        this.properties.initialize([
          'arguments', null, ___,
          'caller', null, ___,
          'length', len, ___,
          'name', name, nameAttrs
        ]);
      }

      hide(this, 'Realm');
      hide(this, 'Code');
      hide(this, 'Scope');
      hide(this, 'FormalParameters');
      hide(this, 'Strict');
      hide(this, 'ThisMode');
    }

    inherit($Function, $Object, {
      NativeBrand: BRANDS.NativeFunction,
      FormalParameters: null,
      Code: null,
      Scope: null,
      Strict: false,
      ThisMode: 'global',
      Realm: null
    }, [
      function Call(receiver, args, isConstruct){
        if (realm !== this.Realm) {
          activate(this.Realm);
        }
        if (this.ThisMode === 'lexical') {
          var local = new DeclarativeEnvironmentRecord(this.Scope);
        } else {
          if (this.ThisMode !== 'strict') {
            if (receiver == null) {
              receiver = this.Realm.global;
            } else if (typeof receiver !== OBJECT) {
              receiver = ToObject(receiver);
              if (receiver.Completion) {
                if (receiver.Abrupt) return receiver; else receiver = receiver.value;
              }
            }
          }
          var local = new FunctionEnvironmentRecord(receiver, this);
        }

        var caller = context ? context.callee : null;

        ExecutionContext.push(new ExecutionContext(context, local, realm, this.Code, this, isConstruct));
        var status = FunctionDeclarationInstantiation(this, args, local);
        if (status && status.Abrupt) {
          ExecutionContext.pop();
          return status;
        }

        if (!this.thunk) {
          this.thunk = new Thunk(this.Code);
          hide(this, 'thunk');
        }

        if (!this.Strict) {
          this.define('arguments', local.arguments, ___);
          this.define('caller', caller, ___);
          local.arguments = null;
        }

        var result = this.thunk.run(context);

        if (!this.Strict) {
          this.define('arguments', null, ___);
          this.define('caller', null, ___);
        }

        ExecutionContext.pop();
        return result && result.type === Return ? result.value : result;
      },
      function Construct(args){
        if (this.ThisMode === 'lexical') {
          return ThrowException('construct_arrow_function');
        }
        var prototype = this.Get('prototype');
        if (prototype && prototype.Completion) {
          if (prototype.Abrupt) return prototype; else prototype = prototype.value;
        }

        var instance = typeof prototype === OBJECT ? new $Object(prototype) : new $Object;
        if (this.NativeConstructor) {
          instance.NativeBrand = prototype.NativeBrand;
        } else if (this.Class) {
          instance.Brand = prototype.Brand;
        }
        instance.ConstructorName = this.get('name');

        var result = this.Call(instance, args, true);
        if (result && result.Completion) {
          if (result.Abrupt) return result; else result = result.value;
        }
        return typeof result === OBJECT ? result : instance;
      },
      function HasInstance(arg){
        if (typeof arg !== OBJECT || arg === null) {
          return false;
        }

        var prototype = this.Get('prototype');
        if (prototype.Completion) {
          if (prototype.Abrupt) return prototype; else prototype = prototype.value;
        }

        if (typeof prototype !== OBJECT) {
          return ThrowException('instanceof_nonobject_proto');
        }

        while (arg) {
          arg = arg.getPrototype();
          if (prototype === arg) {
            return true;
          }
        }
        return false;
      }
    ]);

    return $Function;
  })();


  var $BoundFunction = (function(){
    function $BoundFunction(target, boundThis, boundArgs){
      $Object.call(this, intrinsics.FunctionProto);
      this.TargetFunction = target;
      this.BoundThis = boundThis;
      this.BoundArgs = boundArgs;
      this.properties.initialize([
        'arguments', intrinsics.ThrowTypeError, __A,
        'caller', intrinsics.ThrowTypeError, __A,
        'length', target.properties.get('length'), ___
      ]);
    }

    inherit($BoundFunction, $Function, {
      TargetFunction: null,
      BoundThis: null,
      BoundArguments: null
    }, [
      function Call(_, newArgs){
        return this.TargetFunction.Call(this.BoundThis, this.BoundArgs.concat(newArgs));
      },
      function Construct(newArgs){
        if (!this.TargetFunction.Construct) {
          return ThrowException('not_constructor', this.TargetFunction.name);
        }
        return this.TargetFunction.Construct(this.BoundArgs.concat(newArgs));
      },
      function HasInstance(arg){
        if (!this.TargetFunction.HasInstance) {
          return ThrowException('instanceof_function_expected', this.TargetFunction.name);
        }
        return This.TargetFunction.HasInstance(arg);
      }
    ]);

    return $BoundFunction;
  })();

  var $GeneratorFunction = (function(){
    function $GeneratorFunction(){
      $Function.apply(this, arguments);
    }

    inherit($GeneratorFunction, $Function, [
      function Call(receiver, args){
        if (realm !== this.Realm) {
          activate(this.Realm);
        }
        if (this.ThisMode === 'lexical') {
          var local = new DeclarativeEnvironmentRecord(this.Scope);
        } else {
          if (this.ThisMode !== 'strict') {
            if (receiver == null) {
              receiver = this.Realm.global;
            } else if (typeof receiver !== OBJECT) {
              receiver = ToObject(receiver);
              if (receiver.Completion) {
                if (receiver.Abrupt) return receiver; else receiver = receiver.value;
              }
            }
          }
          var local = new FunctionEnvironmentRecord(receiver, this);
        }

        var ctx = new ExecutionContext(context, local, this.Realm, this.Code, this);
        ExecutionContext.push(ctx);

        var status = FunctionDeclarationInstantiation(this, args, local);
        if (status && status.Abrupt) {
          ExecutionContext.pop();
          return status;
        }

        if (!this.thunk) {
          this.thunk = new Thunk(this.Code);
          hide(this, 'thunk');
        }

        var result = new $Generator(this.Realm, local, ctx, this.thunk);
        ExecutionContext.pop();
        return result;
      }
    ]);

    return $GeneratorFunction;
  })();


  var $Generator = (function(){
    function setFunction(obj, name, func){
      obj.set(name, new $NativeFunction({
        name: name,
        length: func.length,
        call: func
      }));
    }

    function $Generator(realm, scope, ctx, thunk){
      $Object.call(this);
      this.Realm = realm;
      this.Scope = scope;
      this.Code = thunk.code;
      this.ExecutionContext = ctx;
      this.State = 'newborn';
      this.thunk = thunk;

      var self = this;
      setFunction(this, 'iterator', function(){ return self });
      setFunction(this, 'next',     function(){ return self.Send() });
      setFunction(this, 'close',    function(){ return self.Close() });
      setFunction(this, 'send',     function(v){ return self.Send(v) });
      setFunction(this, 'throw',    function(v){ return self.Throw(v) });

      hide(this, 'thunk');
      hide(this, 'Realm');
      hide(this, 'Code');
    }

    inherit($Generator, $Object, {
      Code: null,
      ExecutionContext: null,
      Scope: null,
      Handler: null,
      State: null,
    }, [
      function Send(value){
        if (this.State === 'executing') {
          return ThrowException('generator_executing', 'send');
        } else if (this.State === 'closed') {
          return ThrowException('generator_closed', 'send');
        }
        if (this.State === 'newborn') {
          if (value !== undefined) {
            return ThrowException('generator_send_newborn');
          }
          this.ExecutionContext.currentGenerator = this;
          this.State = 'executing';
          ExecutionContext.push(this.ExecutionContext);
          return this.thunk.run(this.ExecutionContext);
        }

        this.State = 'executing';
        return Resume(this.ExecutionContext, 'normal', value);
      },
      function Throw(value){
        if (this.State === 'executing') {
          return ThrowException('generator_executing', 'throw');
        } else if (this.State === 'closed') {
          return ThrowException('generator_closed', 'throw');
        }
        if (this.State === 'newborn') {
          this.State = 'closed';
          this.Code = null;
          return new AbruptCompletion('throw', value);
        }

        this.State = 'executing';
        var result = Resume(this.ExecutionContext, 'throw', value);
      },
      function Close(value){
        if (this.State === 'executing') {
          return ThrowException('generator_executing', 'close');
        } else if (this.State === 'closed') {
          return;
        }

        if (state === 'newborn') {
          this.State = 'closed';
          this.Code = null;
          return;
        }

        this.State = 'executing';
        var result = Resume(this.ExecutionContext, 'return', value);
        this.State = 'closed';
        return result;
      }
    ]);


    function Resume(ctx, completionType, value){
      ExecutionContext.push(ctx);
      if (completionType !== 'normal') {
        value = new AbruptCompletion(completionType, value);
      }
      return ctx.currentGenerator.thunk.send(ctx, value);
    }

    return $Generator;
  })();





  // #############
  // ### $Date ###
  // #############

  var $Date = (function(){
    function $Date(value){
      $Object.call(this, intrinsics.DateProto);
      this.PrimitiveValue = value;
    }

    inherit($Date, $Object, {
      NativeBrand: BRANDS.NativeDate,
    });

    return $Date;
  })();



  // ###############
  // ### $String ###
  // ###############

  var $String = (function(){
    function $String(value){
      $Object.call(this, intrinsics.StringProto);
      this.PrimitiveValue = value;
      this.define('length', value.length, ___);
    }

    inherit($String, $Object, {
      NativeBrand: BRANDS.StringWrapper,
      PrimitiveValue: undefined
    }, [
      function GetOwnProperty(key){
        var desc = $Object.prototype.GetOwnProperty.call(this, key);
        if (desc) {
          return desc;
        }
        if (key < this.PrimitiveValue.length && key >= 0) {
          return new StringIndice(this.PrimitiveValue[key]);
        }
      },
      function Get(key){
        if (key < this.PrimitiveValue.length && key >= 0) {
          return this.PrimitiveValue[key];
        }
        return this.GetP(this, key);
      },
      function HasOwnProperty(key){
        key = ToPropertyName(key);
        if (key && key.Completion) {
          if (key.Abrupt) return key; else key = key.value;
        }
        if (typeof key === 'string') {
          if (key < this.get('length') && key >= 0) {
            return true;
          }
        }
        return $Object.prototype.HasOwnProperty.call(this, key);
      },
      function HasProperty(key){
        var ret = this.HasOwnProperty(key);
        if (ret && ret.Completion) {
          if (ret.Abrupt) return ret; else ret = ret.value;
        }
        if (ret === true) {
          return true;
        } else {
          return $Object.prototype.HasProperty.call(this, key);
        }
      },
      function Enumerate(includePrototype, onlyEnumerable){
        var props = $Object.prototype.Enumerate.call(this, includePrototype, onlyEnumerable);
        return unique(numbers(this.PrimitiveValue.length).concat(props));
      }
    ]);

    return $String;
  })();


  // ###############
  // ### $Number ###
  // ###############

  var $Number = (function(){
    function $Number(value){
      $Object.call(this, intrinsics.NumberProto);
      this.PrimitiveValue = value;
    }

    inherit($Number, $Object, {
      NativeBrand: BRANDS.NumberWrapper,
      PrimitiveValue: undefined,
    });

    return $Number;
  })();


  // ################
  // ### $Boolean ###
  // ################

  var $Boolean = (function(){
    function $Boolean(value){
      $Object.call(this, intrinsics.BooleanProto);
      this.PrimitiveValue = value;
    }

    inherit($Boolean, $Object, {
      NativeBrand: BRANDS.BooleanWrapper,
      PrimitiveValue: undefined,
    });

    return $Boolean;
  })();



  // ############
  // ### $Map ###
  // ############

  var $Map = (function(){
    function $Map(){
      $Object.call(this, intrinsics.MapProto);
    }

    inherit($Map, $Object, {
      NativeBrand: BRANDS.NativeMap
    });

    return $Map;
  })();


  // ############
  // ### $Set ###
  // ############

  var $Set = (function(){
    function $Set(){
      $Object.call(this, intrinsics.SetProto);
    }

    inherit($Set, $Object, {
      NativeBrand: BRANDS.NativeSet
    });

    return $Set;
  })();



  // ################
  // ### $WeakMap ###
  // ################

  var $WeakMap = (function(){
    function $WeakMap(){
      $Object.call(this, intrinsics.WeakMapProto);
    }

    inherit($WeakMap, $Object, {
      NativeBrand: BRANDS.NativeWeakMap,
    });

    return $WeakMap;
  })();



  // ##############
  // ### $Array ###
  // ##############

  var $Array = (function(){
    function $Array(items){
      $Object.call(this, intrinsics.ArrayProto);
      if (items instanceof Array) {
        var len = items.length;
        for (var i=0; i < len; i++) {
          this.set(i, items[i]);
        }
      } else {
        var len = 0;
      }
      this.set('length', len, _CW);
    }

    inherit($Array, $Object, {
      NativeBrand: BRANDS.NativeArray
    }, [
      function DefineOwnProperty(key, desc, strict){
        var oldLenDesc = this.GetOwnProperty('length'),
            oldLen = oldLenDesc.Value,
            reject = strict ? function(e, a){ return ThrowException(e, a) }
                            : function(e, a){ return false };


        if (key === 'length') {
          if (!(VALUE in desc)) {
            return DefineOwn.call(this, 'length', desc, strict);
          }

          var newLenDesc = copy(desc),
              newLen = ToUint32(desc.Value);

          if (newLen.Completion) {
            if (newLen.Abrupt) return newLen; else newLen = newLen.value;
          }

          var value = ToNumber(desc.Value);
          if (value.Completion) {
            if (value.Abrupt) return value; else value = value.value;
          }

          if (newLen !== value) {
            return reject('invalid_array_length');
          }

          newLen = newLenDesc.Value;
          if (newLen >= oldLen) {
            return DefineOwn.call(this, 'length', newLenDesc, strict);
          }

          if (oldLenDesc.Writable === false) {
            return reject('strict_cannot_assign')
          }

          if (!(WRITABLE in newLenDesc) || newLenDesc.Writable) {
            var newWritable = true;
          } else {
            newWritable = false;
            newLenDesc.Writable = true;
          }

          var success = DefineOwn.call(this, 'length', newLenDesc, strict);
          if (success.Completion) {
            if (success.Abrupt) return success; else success = success.value;
          }
          if (success === false) {
            return false;
          }

          while (newLen < oldLen) {
            oldLen = oldLen - 1;
            var deleted = this.Delete(''+oldLen, false);
            if (deleted.Completion) {
              if (deleted.Abrupt) return deleted; else deleted = deleted.value;
            }

            if (!deleted) {
              newLenDesc.Value = oldLen + 1;
              if (!newWritable) {
                newLenDesc.Writable = false;
              }
              DefineOwn.call(this, 'length', newLenDesc, false);
              return reject('strict_delete_property');
            }
          }
          if (!newWritable) {
            DefineOwn.call(this, 'length', { Writable: false }, false);
          }

          return true;
        }  else if (IsArrayIndex(key)) {
          var index = ToUint32(key);

          if (index.Completion) {
            if (index.Abrupt) return index; else index = index.value;
          }

          if (index >= oldLen && oldLenDesc.Writable === false) {
            return reject('strict_cannot_assign');
          }

          success = DefineOwn.call(this, key, desc, false);
          if (success.Completion) {
            if (success.Abrupt) return success; else success = success.value;
          }

          if (success === false) {
            return reject('strict_cannot_assign');
          }

          if (index >= oldLen) {
            oldLenDesc.Value = index + 1;
            DefineOwn.call(this, 'length', oldLenDesc, false);
          }
          return true;
        }

        return DefineOwn.call(this, key, desc, key);
      }
    ]);

    return $Array;
  })();


  // ###############
  // ### $RegExp ###
  // ###############

  var $RegExp = (function(){
    function $RegExp(primitive){
      if (!this.properties) {
        $Object.call(this, intrinsics.RegExpProto);
      }
      this.PrimitiveValue = primitive;
      this.properties.initialize([
        'global', primitive.global, ___,
        'ignoreCase', primitive.ignoreCase, ___,
        'lastIndex', primitive.lastIndex, __W,
        'multiline', primitive.multiline, ___,
        'source', primitive.source, ___
      ]);
    }

    inherit($RegExp, $Object, {
      NativeBrand: BRANDS.NativeRegExp,
      Match: null,
    });

    return $RegExp;
  })();


  // ###############
  // ### $Symbol ###
  // ###############

  var $Symbol = (function(){
    var seed = Math.random() * 4294967296 | 0;

    function $Symbol(name, isPublic){
      $Object.call(this, intrinsics.SymbolProto);
      this.Symbol = seed++;
      this.Name = name;
      this.Private = !isPublic;
    }

    inherit($Symbol, $Object, {
      NativeBrand: BRANDS.NativeSymbol,
      Extensible: false
    }, [
      function toString(){
        return this.Symbol;
      }
    ]);

    return $Symbol;
  })();


  // ##################
  // ### $Arguments ###
  // ##################

  var $Arguments = (function(){
    function $Arguments(length){
      $Object.call(this);
      this.properties.set('length', length, _CW);
    }

    inherit($Arguments, $Object, {
      NativeBrand: BRANDS.NativeArguments,
      ParameterMap: null,
    });

    return $Arguments;
  })();


  var $StrictArguments = (function(){
    function $StrictArguments(args){
      $Arguments.call(this, args.length);
      for (var i=0; i < args.length; i++) {
        this.properties.set(i+'', args[i], ECW);
      }

      this.properties.set('arguments', intrinsics.ThrowTypeError, __A);
      this.properties.set('caller', intrinsics.ThrowTypeError, __A);
    }

    inherit($StrictArguments, $Arguments);

    return $StrictArguments;
  })();



  var $MappedArguments = (function(){
    function $MappedArguments(names, env, args, func){
      var mapped = create(null);
      $Arguments.call(this, args.length);

      this.ParameterMap = new $Object;
      this.isMapped = false;

      for (var i=0; i < args.length; i++) {
        this.properties.set(i+'', args[i], ECW);
        var name = names[i];
        if (i < names.length && !(name in mapped)) {
          this.isMapped = true;
          mapped[name] = true;
          this.ParameterMap.properties.set(name, new ArgAccessor(name, env), _CA);
        }
      }

      this.properties.set('callee', func, _CW);
    }

    inherit($MappedArguments, $Arguments, {
      ParameterMap: null,
    }, [
      function Get(key){
        if (this.isMapped && this.ParameterMap.has(key)) {
          return this.ParameterMap.Get(key);
        } else {
          var val = this.GetP(this, key);
          if (key === 'caller' && IsCallable(val) && val.Strict) {
            return ThrowException('strict_poison_pill');
          }
          return val;
        }
      },
      function GetOwnProperty(key){
        var desc = $Object.prototype.GetOwnProperty.call(this, key);
        if (desc === undefined) {
          return desc;
        }
        if (this.isMapped && this.ParameterMap.has(key)) {
          desc.Value = this.ParameterMap.Get(key);
        }
        return desc;
      },
      function DefineOwnProperty(key, desc, strict){
        if (!DefineOwn.call(this, key, desc, false) && strict) {
          return ThrowException('strict_lhs_assignment');
        }

        if (this.isMapped && this.ParameterMap.has(key)) {
          if (IsAccessorDescriptor(desc)) {
            this.ParameterMap.Delete(key, false);
          } else {
            if ('Value' in desc) {
              this.ParameterMap.Put(key, desc.Value, strict);
            }
            if ('Writable' in desc) {
              this.ParameterMap.Delete(key, false);
            }
          }
        }

        return true;
      },
      function Delete(key, strict){
        var result = $Object.prototype.Delete.call(this, key, strict);
        if (result.Abrupt) {
          return result;
        }

        if (result && this.isMapped && this.ParameterMap.has(key)) {
          this.ParameterMap.Delete(key, false);
        }

        return result;
      }
    ]);

    return $MappedArguments;
  })();

  var $Module = (function(){
    function ModuleGetter(ref){
      var getter = this.Get = {
        Call: function(){
          var value = GetValue(ref);
          ref = null;
          getter.Call = function(){ return value };
          return value;
        }
      };
    }

    inherit(ModuleGetter, Accessor);


    function $Module(object, names){
      if (object instanceof $Module) {
        return object;
      }

      $Object.call(this, null);
      this.remove('__proto__');
      var self = this;

      each(names, function(name){
        self.define(name, new ModuleGetter(new Reference(object, name)), E_A);
      });
    }

    inherit($Module, $Object, {
      NativeBrand: BRANDS.NativeModule,
      Extensible: false
    });

    return $Module;
  })();


  var $Error = (function(){
    function $Error(name, type, message){
      $Object.call(this, intrinsics[name+'Proto']);
      this.define('message', message, ECW);
      if (type !== undefined) {
        this.define('type', type, _CW);
      }
    }

    inherit($Error, $Object, {
      NativeBrand: BRANDS.NativeError
    }, [
      function setOrigin(filename, kind){
        if (filename) {
          this.set('filename', filename);
        }
        if (kind) {
          this.set('kind', kind);
        }
      },
      function setCode(loc, code){
        var line = code.split('\n')[loc.start.line - 1];
        var pad = new Array(loc.start.column).join('-') + '^';
        this.set('line', loc.start.line);
        this.set('column', loc.start.column);
        this.set('code', line + '\n' + pad);
      }
    ]);

    return $Error;
  })();


  var $Proxy = (function(){
    function IsCompatibleDescriptor(){
      return true;
    }

    function GetTrap(handler, trap){
      var result = handler.Get(trap);
      if (result !== undefined && !IsCallable(result)) {
        return ThrowException('non_callable_proxy_trap');
      }
      return result;
    }

    function TrapDefineOwnProperty(proxy, key, descObj, strict){
      var handler = proxy.Handler,
          target = proxy.Target,
          trap = GetTrap(handler, 'defineProperty'),
          normalizedDesc = ToPropertyDescriptor(descObj);

      if (trap === undefined) {
        return target.DefineOwnProperty(key, normalizedDesc, strict);
      } else {
        var normalizedDescObj = FromGenericPropertyDescriptor(normalizedDesc);
        CopyAttributes(descObj, normalizedDescObj);

        var trapResult = trap.Call(handler, [target, key, normalizedDescObj]),
            success = ToBoolean(trapResult),
            targetDesc = target.GetOwnProperty(key),
            extensible = target.getExtensible();

        if (!extensible && targetDesc === undefined) {
          return ThrowException('proxy_configurability_non_extensible_inconsistent');
        } else if (targetDesc !== undefined && !IsCompatibleDescriptor(extensible, targetDesc, ToPropertyDescriptor(normalizedDesc))) {
          return ThrowException('proxy_incompatible_descriptor');
        } else if (!normalizedDesc.Configurable) {
          if (targetDesc === undefined || targetDesc.Configurable) {
            return ThrowException('proxy_configurability_inconsistent')
          }
        } else if (strict) {
          return ThrowException('strict_property_redefinition');
        }
        return false;
      }
    }

    function TrapGetOwnProperty(proxy, key){
      var handler = proxy.Handler,
          target = proxy.Target,
          trap = GetTrap(handler, 'getOwnPropertyDescriptor');

      if (trap === undefined) {
        return target.GetOwnProperty(key);
      } else {
        var trapResult = trap.Call(handler, [target, key]),
            desc = NormalizeAndCompletePropertyDescriptor(trapResult),
            targetDesc = target.GetOwnProperty(key);

        if (desc === undefined) {
          if (targetDesc !== undefined) {
            if (!targetDesc.Configurable) {
              return ThrowException('proxy_configurability_inconsistent');
            } else if (!target.getExtensible()) {
              return ThrowException('proxy_configurability_non_extensible_inconsistent');
            }
            return undefined;
          }
        }
        var extensible = target.getExtensible();
        if (!extensible && targetDesc === undefined) {
          return ThrowException('proxy_configurability_non_extensible_inconsistent');
        } else if (targetDesc !== undefined && !IsCompatibleDescriptor(extensible, targetDesc, ToPropertyDescriptor(desc))) {
          return ThrowException('proxy_incompatible_descriptor');
        } else if (!ToBoolean(desc.Get('configurable'))) {
          if (targetDesc === undefined || targetDesc.Configurable) {
            return ThrowException('proxy_configurability_inconsistent')
          }
        }
        return desc;
      }
    }



    function $Proxy(target, handler){
      this.Handler = handler;
      this.Target = target;
      this.NativeBrand = target.NativeBrand;
      if ('Call' in target) {
        this.HasInstance = $Function.prototype.HasInstance;
        this.Call = ProxyCall;
        this.Construct = ProxyConstruct;
      }
      if ('PrimitiveValue' in target) {
        this.PrimitiveValue = target.PrimitiveValue;
      }
    }

    inherit($Proxy, $Object, {
      Proxy: true
    }, [
      function getPrototype(){
        var trap = GetTrap(this.Handler, 'getPrototypeOf');
        if (trap === undefined) {
          return this.Target.getPrototype();
        } else {
          var result = trap.Call(this.Handler, [this.Target]),
              targetProto = this.Target.getPrototype();

          if (result !== targetProto) {
            return ThrowException('proxy_prototype_inconsistent');
          } else {
            return targetProto;
          }
        }
      },
      function getExtensible(){
        var trap = GetTrap(this.Handler, 'isExtensible');
        if (trap === undefined) {
          return this.Target.getExtensible();
        }
        var proxyIsExtensible = ToBoolean(trap.Call(this.Handler, [this.Target])),
            targetIsExtensible  = this.Target.getExtensible();

        if (proxyIsExtensible !== targetIsExtensible) {
          return ThrowException('proxy_extensibility_inconsistent');
        }
        return targetIsExtensible;
      },
      function GetP(receiver, key){
        var trap = GetTrap(this.Handler, 'get');
        if (trap === undefined) {
          return this.Target.GetP(receiver, key);
        }

        var trapResult = trap.Call(this.Handler, [this.Target, key, receiver]),
            desc = this.Target.GetOwnProperty(key);

        if (desc !== undefined) {
          if (IsDataDescriptor(desc) && desc.Configurable === false && desc.Writable === false) {
            if (!IS(trapResult, desc.Value)) {
              return ThrowException('proxy_get_inconsistent');
            }
          } else if (IsAccessorDescriptor(desc) && desc.Configurable === false && desc.Get === undefined) {
            if (trapResult !== undefined) {
              return ThrowException('proxy_get_inconsistent');
            }
          }
        }

        return trapResult;
      },
      function SetP(receiver, key, value){
        var trap = GetTrap(this.Handler, 'set');
        if (trap === undefined) {
          return this.Target.SetP(receiver, key, value);
        }

        var trapResult = trap.Call(this.Handler, [this.Target, key, value, receiver]),
            success = ToBoolean(trapResult);

        if (success) {
          var desc = this.Target.GetOwnProperty(key);
          if (desc !== undefined) {
            if (IsDataDescriptor(desc) && desc.Configurable === false && desc.Writable === false) {
              if (!IS(value, desc.Value)) {
                return ThrowException('proxy_set_inconsistent');
              }
            }
          } else if (IsAccessorDescriptor(desc) && desc.Configurable === false) {
            if (desc.Set !== undefined) {
              return ThrowException('proxy_set_inconsistent');
            }
          }
        }

        return success;
      },
      function GetOwnProperty(key){
        var desc = TrapGetOwnProperty(this, key);
        if (desc !== undefined) {
          return desc;
        }
      },
      function DefineOwnProperty(key, desc, strict){
        var descObj = FromGenericPropertyDescriptor(desc);
        return TrapDefineOwnProperty(this, key, descObj, strict);
      },
      function HasOwnProperty(key){
        var trap = GetTrap(this.Handler, 'hasOwn');
        if (trap === undefined) {
          return this.Target.HasOwnProperty(key);
        }

        var trapResult = trap.Call(this.Handler, [this.Target, key]),
            success = ToBoolean(trapResult);

        if (success === false) {
          var targetDesc = this.Target.GetOwnProperty(key);
          if (desc !== undefined && targetDesc.Configurable === false) {
            return ThrowException('proxy_hasown_inconsistent');
          } else if (!this.Target.getExtensible() && targetDesc !== undefined) {
            return ThrowException('proxy_hasown_inconsistent');
          }
        }
        return success;
      },
      function HasProperty(key){
        var trap = GetTrap(this.Handler, 'has');
        if (trap === undefined) {
          return this.Target.HasProperty(key);
        }

        var trapResult = trap.Call(this.Handler, [this.Target, key]),
            success = ToBoolean(trapResult);

        if (success === false) {
          var targetDesc = this.Target.GetOwnProperty(key);
          if (desc !== undefined && targetDesc.Configurable === false) {
            return ThrowException('proxy_has_inconsistent');
          } else if (!this.Target.getExtensible() && targetDesc !== undefined) {
            return ThrowException('proxy_has_inconsistent');
          }
        }
        return success;
      },
      function Delete(key, strict){
        var trap = GetTrap(this.Handler, 'deleteProperty');
        if (trap === undefined) {
          return this.Target.Delete(key, strict);
        }
        var trapResult = trap.Call(this.Handler, [this.Target, key]),
            success = ToBoolean(trapResult);

        if (success === true) {
          var targetDesc = this.Target.GetOwnProperty(key);
          if (desc !== undefined && targetDesc.Configurable === false) {
            return ThrowException('proxy_delete_inconsistent');
          } else if (!this.Target.getExtensible() && targetDesc !== undefined) {
            return ThrowException('proxy_delete_inconsistent');
          }
          return true;
        } else if (strict) {
          return ThrowException('strict_delete_failure');
        } else {
          return false;
        }
      },
      function Enumerate(includePrototype, onlyEnumerable){
        if (onlyEnumerable) {
          var trap = includePrototype ? 'enumerate' : 'keys';
        } else {
          var trap = 'getOwnPropertyNames',
              recurse = includePrototype;
        }
        var trap = GetTrap(this.Handler, trap);
        if (trap === undefined) {
          return this.Target.Enumerate(includePrototype, onlyEnumerable);
        }

        var trapResult = trap.Call(this.Handler, [this.Target, key]);

        if (Type(trapResult) !== 'Object') {
          return ThrowException(trap+'_trap_non_object');
        }

        var len = ToUint32(trapResult.Get('length')),
            array = [],
            seen = create(null);

        for (var i = 0; i < len; i++) {
          var element = ToString(trapResult.Get(''+i));
          if (element in seen) {
            return ThrowException('trap_returned_duplicate', trap);
          }
          seen[element] = true;
          if (!includePrototype && !this.Target.getExtensible() && !this.Target.HasOwnProperty(element)) {
            return ThrowException('proxy_'+trap+'_inconsistent');
          }
          array[i] = element;
        }

        var props = this.Target.Enumerate(includePrototype, onlyEnumerable),
            len = props.length;

        for (var i=0; i < len; i++) {
          if (!(props[i] in seen)) {
            var targetDesc = this.Target.GetOwnProperty(props[i]);
            if (targetDesc && !targetDesc.Configurable) {
              return ThrowException('proxy_'+trap+'_inconsistent');
            }
            if (targetDesc && !this.Target.getExtensible()) {
              return ThrowException('proxy_'+trap+'_inconsistent');
            }
          }
        }

        return array;
      }
    ]);

    function ProxyCall(thisValue, args){
      var trap = GetTrap(this.Handler, 'apply');
      if (trap === undefined) {
        return this.Target.Call(thisValue, args);
      }

      return trap.Call(this.Handler, [this.Target, thisValue, fromInternalArray(args)]);
    }

    function ProxyConstruct(args){
      var trap = GetTrap(this.Handler, 'construct');
      if (trap === undefined) {
        return this.Target.Construct(args);
      }

      return trap.Call(this.Handler, [this.Target, fromInternalArray(args)]);
    }

    return $Proxy;
  })();




  var $PrimitiveBase = (function(){
    function $PrimitiveBase(value){
      this.PrimitiveValue = value;
      switch (typeof value) {
        case STRING:
          $Object.call(this, intrinsics.StringProto);
          this.NativeBrand = BRANDS.StringWrapper;
          break;
        case NUMBER:
          $Object.call(this, intrinsics.NumberProto);
          this.NativeBrand = BRANDS.NumberWrapper;
          break;
        case BOOLEAN:
          $Object.call(this, intrinsics.BooleanProto);
          this.NativeBrand = BRANDS.BooleanWrapper;
          break;
      }
    }

    operators.$PrimitiveBase = $PrimitiveBase;

    inherit($PrimitiveBase, $Object, [
      function SetP(receiver, key, value, strict){
        var desc = this.GetProperty(key);
        if (desc) {
          if (IsDataDescriptor(desc)) {
            return desc.Value;
          } else if (desc.Get) {
            if (!receiver) {
              receiver = this.PrimitiveValue;
            }

            return desc.Get.Call(receiver, []);
          }
        }
      },
      function GetP(receiver, key) {
        var desc = this.GetProperty(key);
        if (desc) {
          if (IsDataDescriptor(desc)) {
            return desc.Value;
          } else if (desc.Get) {
            if (!receiver) {
              receiver = this.PrimitiveValue;
            }

            return desc.Get.Call(receiver, []);
          }
        }
      }
    ]);

    return $PrimitiveBase;
  })();




  var $NativeFunction = (function(){
    function $NativeFunction(options){
      if (options.proto === undefined) {
        options.proto = intrinsics.FunctionProto;
      }
      $Object.call(this, options.proto);

      this.properties.initialize([
        'arguments', null, ___,
        'caller', null, ___,
        'length', options.length, ___,
        'name', options.name, ___
      ]);

      this.call = options.call;
      if (options.construct) {
        this.construct = options.construct;
      }

      this.Realm = realm;
      hide(this, 'Realm');
      hide(this, 'call');
    }

    inherit($NativeFunction, $Function, {
      Native: true,
    }, [
      function Call(receiver, args){
        var result = this.call.apply(receiver, [].concat(args));
        return result && result.type === Return ? result.value : result;
      },
      function Construct(args){
        if (this.construct) {
          var instance = this.has('prototype') ? new $Object(this.get('prototype')) : new $Object;
          instance.ConstructorName = this.get('name');
          var result = this.construct.apply(instance, args);
        } else {
          var result = this.call.apply(undefined, args);
        }
        return result && result.type === Return ? result.value : result;
      }
    ]);

    return $NativeFunction;
  })();


  var $NativeObject = (function(){
    function $NativeObject(){}

    inherit($NativeObject, $Object, {
      Native: true,
    }, [
      function has(key){},
      function remove(key){},
      function describe(key){},
      function define(key, value, attrs){},
      function get(key){},
      function set(key, value){},
      function each(callback){},
      function getPrototype(){},
      function setPrototype(value){},
      function getExtensible(){},
      function setExtensible(value){},
    ]);

    return $NativeObject;
  })();


  var ExecutionContext = (function(){
    function ExecutionContext(caller, local, realm, code, func, isConstruct){
      this.caller = caller;
      this.Realm = realm;
      this.Code = code;
      this.LexicalEnvironment = local;
      this.VariableEnvironment = local;
      this.Strict = code.Strict;
      this.isConstruct = !!isConstruct;
      this.callee = func && !func.Native ? func : caller ? caller.callee : null;
    }

    define(ExecutionContext, [
      function push(newContext){
        context = newContext;
        context.Realm.active || activate(context.Realm);
      },
      function pop(){
        if (context) {
          var oldContext = context;
          context = context.caller;
          return oldContext;
        }
      },
      function reset(){
        var stack = [];
        while (context) {
          stack.push(ExecutionContext.pop());
        }
        return stack;
      }
    ]);

    define(ExecutionContext.prototype, {
      isGlobal: false,
      strict: false,
      isEval: false,
    });

    define(ExecutionContext.prototype, [
      function pop(){
        if (this === context) {
          context = this.caller;
          return this;
        }
      },
      function initializeBinding(name, value){
        return this.LexicalEnvironment.InitializeBinding(name, value);
      },
      function initializeBindings(pattern, value){
        return BindingInitialization(pattern, value, this.LexicalEnvironment);
      },
      function popBlock(){
        var block = this.LexicalEnvironment;
        this.LexicalEnvironment = this.LexicalEnvironment.outer;
        return block;
      },
      function pushBlock(decls){
        this.LexicalEnvironment = new DeclarativeEnvironmentRecord(this.LexicalEnvironment);
        return BlockDeclarationInstantiation(decls, this.LexicalEnvironment);
      },
      function pushClass(def, superclass){
        return ClassDefinitionEvaluation(def.name, superclass, def.ctor, def.methods);
      },
      function pushWith(obj){
        this.LexicalEnvironment = new ObjectEnvironmentRecord(obj, this.LexicalEnvironment);
        this.LexicalEnvironment.withEnvironment = true;
        return obj;
      },
      function defineMethod(kind, obj, key, code){
        return PropertyDefinitionEvaluation(kind, obj, key, code);
      },
      function createFunction(name, code){
        var $F = code.generator ? $GeneratorFunction : $Function;
            env = this.LexicalEnvironment;

        if (name) {
          env = new DeclarativeEnvironmentRecord(env);
          env.CreateImmutableBinding(name);
        }

        var func = new $F(code.Type, name, code.params, code, env, code.Strict);

        if (code.Type !== ARROW) {
          MakeConstructor(func);
          name && env.InitializeBinding(name, func);
        }

        return func;
      },
      function createArray(len){
        return new $Array(len);
      },
      function createObject(proto){
        return new $Object(proto);
      },
      function createRegExp(regex){
        return new $RegExp(regex);
      },
      function constructFunction(func, args){
        return EvaluateConstruct(func, args);
      },
      function callFunction(thisRef, func, args){
        return EvaluateCall(thisRef, func, args);
      },
      function getPropertyReference(name, obj){
        return Element(this, name, obj);
      },
      function getReference(name){
        return IdentifierResolution(this, name);
      },
      function getSuperReference(name){
        return SuperReference(this, name);
      },
      function getThisEnvironment(){
        return GetThisEnvironment(this);
      },
      function getThis(){
        return ThisResolution(this);
      },
      function spreadArguments(precedingArgs, obj){
        return SpreadArguments(precedingArgs, obj);
      },
      function spreadArray(array, offset, obj){
        return SpreadInitialization(array, offset, obj);
      },
      function destructureSpread(target, index){
        return SpreadDestructuring(this, target, index);
      },
      function getTemplateCallSite(template){
        return GetTemplateCallSite(this, template);
      },
      function getSymbol(name){
        return GetSymbol(this, name) || ThrowException('undefined_symbol', name);
      },
      function getSymbolReference(name){
        var symbol = GetSymbol(this, name);
        if (symbol) {
          return symbol//IdentifierResolution(this, symbol);
        } else {
          return ThrowException('undefined_symbol', name);
        }
      },
      function createSymbol(name, isPublic){
        return new $Symbol(name, isPublic);
      },
      function initializeSymbolBinding(name, symbol){
        return this.LexicalEnvironment.InitializeSymbolBinding(name, symbol);
      }
    ]);

    return ExecutionContext;
  })();


  var Intrinsics = (function(){
    var $errors = ['EvalError', 'RangeError', 'ReferenceError',
                   'SyntaxError', 'TypeError', 'URIError'];

    var $builtins = {
      Array   : $Array,
      Boolean : $Boolean,
      Date    : $Date,
      Error   : $Error,
      Function: $Function,
      Map     : $Map,
      Number  : $Number,
      //Proxy   : $Proxy,
      RegExp  : $RegExp,
      Set     : $Set,
      String  : $String,
      Symbol  : $Symbol,
      WeakMap : $WeakMap
    };

    exports.builtins = {
      $Array   : $Array,
      $Boolean : $Boolean,
      $Date    : $Date,
      $Error   : $Error,
      $Function: $Function,
      $Map     : $Map,
      $Number  : $Number,
      $Object  : $Object,
      $RegExp  : $RegExp,
      $Set     : $Set,
      $Symbol  : $Symbol,
      $String  : $String,
      $WeakMap : $WeakMap
    };

    var primitives = {
      Date   : Date.prototype,
      RegExp : RegExp.prototype,
      String : '',
      Number : 0,
      Boolean: false
    };

    function Intrinsics(realm){
      DeclarativeEnvironmentRecord.call(this, null);
      this.Realm = realm;
      var bindings = this.bindings;
      bindings.ObjectProto = new $Object(null);

      for (var k in $builtins) {
        var prototype = bindings[k + 'Proto'] = create($builtins[k].prototype);
        $Object.call(prototype, bindings.ObjectProto);
        if (k in primitives)
          prototype.PrimitiveValue = primitives[k];
      }

      bindings.StopIteration = new $Object(bindings.ObjectProto);
      bindings.StopIteration.NativeBrand = StopIteration;

      for (var i=0; i < 6; i++) {
        var prototype = bindings[$errors[i] + 'Proto'] = create($Error.prototype);
        $Object.call(prototype, bindings.ErrorProto);
        prototype.properties.initialize([
          'name', $errors[i], _CW,
          'type', undefined, _CW,
          'arguments', undefined, _CW
        ]);
      }

      bindings.FunctionProto.FormalParameters = [];
      bindings.ArrayProto.properties.set('length', 0, __W);
      bindings.ErrorProto.properties.initialize([
        'name', 'Error', _CW,
        'message', '', _CW
      ]);
    }

    inherit(Intrinsics, DeclarativeEnvironmentRecord, [
      function binding(options){
        if (typeof options === 'function') {
          options = {
            call: options,
            name: options.name,
            length: options.length,
          }
        }

        if (!options.name) {
          if (!options.call.name) {
            options.name = arguments[1];
          } else {
            options.name = options.call.name;
          }
        }

        if (typeof options.length !== 'number') {
          options.length = options.call.length;
        }

        if (realm !== this.Realm) {
          var activeRealm = realm;
          activate(this.Realm);
        }

        this.bindings[options.name] = new $NativeFunction(options);

        if (activeRealm) {
          activate(activeRealm);
        }
      }
    ]);

    return Intrinsics;
  })();

  function wrapForInside(o){
    if (o === null) return o;

    var type = typeof o;
    if (type === FUNCTION) {
      return new $NativeFunction({
        length: o._length || o.length,
        name: o._name || o.name,
        call: o
      });
    }

    if (type === OBJECT) {
      switch (o.NativeBrand) {
        case BRANDS.NativeFunction:
          var func = function(){
            return o.Call(this, arguments);
          };
          func._wraps = o;
          return func;
        case BRANDS.NativeObject:

      }
    }
    return o;
  }


  function wrapFunction(f){
    if (f._wrapper) {
      return f._wrapper;
    }
    return f._wrapper = function(){
      var receiver = this;
      if (isObject(receiver) && !(receiver instanceof $Object)) {
        receiver = undefined
      }
      return f.Call(receiver, arguments);
    };
  }

  function fromInternalArray(array){
    var $array = new $Array,
        len = array.length;

    for (var i=0; i < len; i++) {
      $array.properties.set(i, array[i], ECW);
    }
    $array.properties.set('length', array.length, __W);
    return $array;
  }

  function toInternalArray($array){
    var array = [],
        len = $array.properties.get('length');

    for (var i=0; i < len; i++) {
      array[i] = $array.properties.get(i);
    }
    return array;
  }

  var Script = (function(){
    var parseOptions = {
      loc    : true,
      range  : true,
      raw    : false,
      tokens : false,
      comment: false
    }

    function parse(src, origin, type, options){
      try {
        return esprima.parse(src, options || parseOptions);
      } catch (e) {
        var err = new $Error('SyntaxError', undefined, e.message);
        err.setCode({ start: { line: e.lineNumber, column: e.column } }, src);
        err.setOrigin(origin, type);
        return new AbruptCompletion('throw', err);
      }
    }

    var load = (function(){
      if (typeof process !== 'undefined') {
        var fs = require('fs');
        return function load(source){
          if (!~source.indexOf('\n') && fs.existsSync(source)) {
            return { scope: SCOPE.GLOBAL, source: fs.readFileSync(source, 'utf8'), filename: source };
          } else {
            return { scope: SCOPE.GLOBAL, source: source, filename: '' };
          }
        };
      }
      return function load(source){
        return { scope: SCOPE.GLOBAL, source: source, filename: '' };
      };
    })();

    function Script(options){
      if (options instanceof Script)
        return options;

      this.type = 'script';

      if (typeof options === FUNCTION) {
        this.type = 'recompiled function';
        if (!utility.fname(options)) {
          options = {
            scope: SCOPE.FUNCTION,
            filename: '',
            source: '('+options+')()'
          }
        } else {
          options = {
            scope: SCOPE.FUNCTION,
            filename: utility.fname(options),
            source: options+''
          };
        }
      } else if (typeof options === STRING) {
        options = load(options);
      }

      if (options.natives) {
        this.natives = true;
        this.type = 'native';
      }
      if (options.eval || options.scope === SCOPE.EVAL) {
        this.eval = true;
        this.type = 'eval';
      }
      this.scope = options.scope;

      if (!isObject(options.ast) && typeof options.source === STRING) {
        this.source = options.source;
        this.ast = parse(options.source, options.filename, this.type);
        if (this.ast.Abrupt) {
          this.error = this.ast;
          this.ast = null;
        }
      }

      this.filename = options.filename || '';
      if (this.ast) {
        this.bytecode = assemble(this);
        this.thunk = new Thunk(this.bytecode);
      }
      return this;
    }

    return Script;
  })();


  var Realm = (function(){

    function CreateThrowTypeError(realm){
      var thrower = create($NativeFunction.prototype);
      $Object.call(thrower, realm.intrinsics.FunctionProto);
      thrower.call = function(){ return ThrowException('strict_poison_pill') };
      thrower.properties.set('length', 0, ___);
      thrower.properties.set('name', 'ThrowTypeError', ___);
      thrower.Realm = realm;
      thrower.Extensible = false;
      thrower.Strict = true;
      hide(thrower, 'Realm');
      return new Accessor(thrower);
    }


    var natives = (function(){
      function wrapNatives(source, target){
        each(utility.ownProperties(source), function(key){
          if (typeof source[key] === 'function'
                          && key !== 'constructor'
                          && key !== 'toString'
                          && key !== 'valueOf') {
            var func = new $NativeFunction({
              name: key,
              length: source[key].length,
              call: function(a, b, c, d){
                var v = this;
                if (v == null) {
                  try { v = source.constructor(v) }
                  catch (e) { v = new source.constructor }
                }
                if (v instanceof source.constructor || typeof v !== 'object') {
                  var result =  v[key](a, b, c, d);
                } else if (v.PrimitiveValue) {
                  var result = v.PrimitiveValue[key](a, b, c, d);
                }
                if (!isObject(result)) {
                  return result;
                }
                if (result instanceof Array) {
                  return fromInternalArray(result);
                }
              }
            });
            target.properties.set(key, func, 6);
          }
        });
      }

      function wrapMapFunction(name){
        return function(map, key, val){
          return map.MapData[name](key, val);
        };
      }

      function wrapWeakMapFunction(name){
        return function(map, key, val){
          return map.WeakMapData[name](key, val);
        };
      }

      var timers = {};

      var nativeCode = ['function ', '() { [native code] }'];

      return {
        has: function(o, key){
          return o.has(key);
        },
        remove: function(o, key){
          o.remove(key);
        },
        set: function(o, key, value){
          return o.set(key, value);
        },
        get: function(o, key){
          return o.get(key);
        },
        define: function(o, key, value, attrs){
          o.define(key, value, attrs);
        },
        query: function(o, key){
          return o.query(key);
        },
        update: function(obj, key, attr){
          var prop = obj.describe(key);
          if (prop) {
            prop[2] &= attr;
            return true;
          }
          return false;
        },
        CheckObjectCoercible: CheckObjectCoercible,
        ToObject: ToObject,
        ToString: ToString,
        ToNumber: ToNumber,
        ToBoolean: ToBoolean,
        ToPropertyName: ToPropertyName,
        ToInteger: ToInteger,
        ToInt32: ToInt32,
        ToUint32: ToUint32,
        ToUint16: ToUint16,
        ToModule: function(obj){
          if (obj.NativeBrand === BRANDS.NativeModule) {
            return obj;
          }
          return new $Module(obj, obj.Enumerate(false, false));
        },
        IsConstructCall: function(){
          return context.isConstruct;
        },
        GetNativeBrand: function(object){
          return object.NativeBrand.name;
        },
        SetNativeBrand: function(object, name){
          var brand = BRANDS[name];
          if (brand) {
            object.NativeBrand = brand;
          } else {
            var err = new $Error('ReferenceError', undefined, 'Unknown NativeBrand "'+name+'"');
            return new AbruptException('throw', err);
          }
          return object.NativeBrand.name;
        },
        GetBrand: function(object){
          return object.Brand || object.NativeBrand.name;
        },
        GetPrimitiveValue: function(object){
          return object ? object.PrimitiveValue : undefined;
        },
        IsObject: function(object){
          return object instanceof $Object;
        },
        SetInternal: function(object, key, value){
          object[key] = value;
          hide(object, key);
        },
        GetInternal: function(object, key){
          if (object) {
            return object[key];
          }
        },
        HasInternal: function(object, key){
          if (object) {
            return key in object;
          }
        },
        SetHidden: function(object, key, value){
          if (object) {
            object.hiddens[key] = value;
          }
        },
        GetHidden: function(object, key){
          if (object) {
            return object.hiddens[key];
          }
        },
        DeleteHidden: function(object, key){
          if (object) {
            if (key in object.hiddens) {
              delete object.hiddens[key];
              return true;
            }
            return false;
          }
        },
        HasHidden: function(object, key){
          if (object) {
            return key in object.hiddens;
          }
        },
        EnumerateHidden: function(object){
          if (object) {
            return fromInternalArray(ownKeys(object.hiddens));
          }
        },
        Type: function(o){
          if (o === null) {
            return 'Null';
          } else {
            switch (typeof o) {
              case UNDEFINED: return 'Undefined';
              case NUMBER:    return 'Number';
              case STRING:    return 'String';
              case BOOLEAN:   return 'Boolean';
              case OBJECT:    return 'Object';
            }
          }
        },
        Exception: function(type, args){
          return MakeException(type, toInternalArray(args));
        },
        Signal: function(name, value){
          if (isObject(value)) {
            if (value instanceof $Array) {
              value = toInternalArray(value);
            } else {
              throw new Error('NYI');
            }
          }
          realm.emit(name, value);
        },
        wrapDateMethods: function(target){
          wrapNatives(Date.prototype, target);
        },
        wrapRegExpMethods: function(target){
          wrapNatives(RegExp.prototype, target);
        },
        now: Date.now || function(){ return +new Date },


        CallFunction: function(func, receiver, args){
          return func.Call(receiver, toInternalArray(args));
        },

        Fetch: function(name, callback){
          var result = require('../modules')[name];
          if (!result) {
            result = new $Error('Error', undefined, 'Unable to locate module "'+name+'"');
          }
          callback.Call(undefined, [result]);
        },

        EvaluateModule: function(source, global, name, errback, callback){
          realm.evaluateModule(source, global, name, wrapFunction(errback), wrapFunction(callback));
        },
        eval: function(code){
          if (typeof code !== 'string') {
            return code;
          }
          var script = new Script({
            scope: SCOPE.EVAL,
            natives: false,
            source: code
          });
          if (script.error) {
            return script.error;
          } else if (script.thunk) {
            return script.thunk.run(context);
          }
        },
        FunctionCreate: function(args){
          args = toInternalArray(args);
          var body = args.pop();
          var script = new Script({
            scope: SCOPE.GLOBAL,
            natives: false,
            source: '(function anonymous('+args.join(', ')+') {\n'+body+'\n})'
          });
          if (script.error) {
            return script.error;
          }
          var ctx = new ExecutionContext(context, new DeclarativeEnvironmentRecord(realm.globalEnv), realm, script.bytecode);
          ExecutionContext.push(ctx);
          var func = script.thunk.run(ctx);
          ExecutionContext.pop();
          return func;
        },
        BoundFunctionCreate: function(func, receiver, args){
          return new $BoundFunction(func, receiver, toInternalArray(args));
        },
        BooleanCreate: function(boolean){
          return new $Boolean(boolean);
        },
        DateCreate: function(args){
          return new $Date(utility.applyNew(Date, toInternalArray(args)));
        },
        NumberCreate: function(number){
          return new $Number(number);
        },
        ObjectCreate: function(proto){
          return new $Object(proto);
        },
        RegExpCreate: function(pattern, flags){
          if (typeof pattern === 'object') {
            pattern = pattern.PrimitiveValue;
          }
          try {
            var result = new RegExp(pattern, flags);
          } catch (e) {
            return ThrowException('invalid_regexp', [pattern+'']);
          }
          return new $RegExp(result);
        },
        ProxyCreate: function(target, handler){
          return new $Proxy(target, handler);
        },
        SymbolCreate: function(name, isPublic){
          return new $Symbol(name, isPublic);
        },
        StringCreate: function(string){
          return new $String(string);
        },

        FunctionToString: function(func){
          if (func.Proxy) {
            func = func.Target;
          }
          var code = func.Code;
          if (func.Native || !code) {
            return nativeCode[0] + func.get('name') + nativeCode[1];
          } else {
            return code.source.slice(code.range[0], code.range[1]);
          }
        },
        NumberToString: function(object, radix){
          return object.PrimitiveValue.toString(radix);
        },
        RegExpToString: function(object){
          return ''+object.PrimitiveValue;
        },
        DateToNumber: function(object){
          return +object.PrimitiveValue;
        },
        DateToString: function(object){
          return ''+object.PrimitiveValue;
        },
        CallNative: function(target, name, args){
          if (args) {
            return target[name].apply(target, toInternalArray(args));
          } else {
            return target[name]();
          }
        },

        CodeUnit: function(char){
          return char.charCodeAt(0);
        },
        StringReplace: function(string, search, replace){
          if (typeof search !== STRING) {
            search = search.PrimitiveValue;
          }
          return string.replace(search, replace);
        },
        StringSplit: function(string, separator, limit){
          if (typeof separator !== STRING) {
            separator = separator.PrimitiveValue;
          }
          return fromInternalArray(string.split(separator, limit));
        },
        StringSearch: function(regexp){
          return string.search(regexp);
        },
        StringSlice: function(string, start, end){
          return end === undefined ? string.slice(start) : string.slice(start, end);
        },
        FromCharCode: String.fromCharCode,
        StringTrim: String.prototype.trim
          ? function(str){ return str.trim() }
          : (function(trimmer){
            return function(str){
              return str.replace(trimmer, '');
            };
          })(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/),
        getExtensible: function(obj){
          return obj.getExtensible();
        },
        setExtensible: function(obj, value){
          return obj.setExtensible(value);
        },
        getPrototype: function(obj){
          return obj.getPrototype();
        },
        DefineOwnProperty: function(obj, key, desc){
          return obj.DefineOwnProperty(key, ToPropertyDescriptor(desc), false);
        },
        Enumerate: function(obj, includePrototype, onlyEnumerable){
          return fromInternalArray(obj.Enumerate(includePrototype, onlyEnumerable));
        },
        GetProperty: function(obj, key){
          var desc = obj.GetProperty(key);
          if (desc) {
            return FromPropertyDescriptor(desc);
          }
        },
        GetOwnProperty: function(obj, key){
          var desc = obj.GetOwnProperty(key);
          if (desc) {
            return FromPropertyDescriptor(desc);
          }
        },
        GetPropertyAttributes: function(obj, key){
          return obj.properties.getAttribute(key);
        },
        HasOwnProperty: function(obj, key){
          return obj.HasOwnProperty(key);
        },
        SetP: function(obj, key, value, receiver){
          return obj.SetP(receiver, key, value);
        },
        GetP: function(obj, key, receiver){
          return obj.GetP(receiver, key);
        },

        parseInt: function(value, radix){
          return parseInt(ToPrimitive(value), ToNumber(radix));
        },
        parseFloat: function(value){
          return parseFloat(ToPrimitive(value));
        },
        decodeURI: function(value){
          return decodeURI(ToString(value));
        },
        decodeURIComponent: function(value){
          return decodeURIComponent(ToString(value));
        },
        encodeURI: function(value){
          return encodeURI(ToString(value));
        },
        encodeURIComponent: function(value){
          return encodeURIComponent(ToString(value));
        },
        escape: function(value){
          return escape(ToString(value));
        },
        SetTimer: function(f, time, repeating){
          if (typeof f === 'string') {
            f = natives.FunctionCreate(f);
          }
          var id = Math.random() * 1000000 << 10;
          timers[id] = setTimeout(function trigger(){
            if (timers[id]) {
              f.Call(global, []);
              if (repeating) {
                timers[id] = setTimeout(trigger, time);
              } else {
                timers[id] = f = null;
              }
            } else {
              f = null;
            }
          }, time);
          return id;
        },
        ClearTimer: function(id){
          if (timers[id]) {
            timers[id] = null;
          }
        },
        Quote: (function(){
          var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
              escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
              meta = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"' : '\\"', '\\': '\\\\' };

          function escaper(a) {
            var c = meta[a];
            return typeof c === 'string' ? c : '\\u'+('0000' + a.charCodeAt(0).toString(16)).slice(-4);
          }

          return function(string){
            escapable.lastIndex = 0;
            return '"'+string.replace(escapable, escaper)+'"';
          };
        })(),
        MathCreate: (function(Math){
          var consts = ['E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'PI', 'SQRT1_2', 'SQRT2'],
              sqrt = Math.sqrt,
              log = Math.log,
              pow = Math.pow,
              exp = Math.exp,
              LN2 = Math.LN2,
              LN10 = Math.LN10;


          function wrapMathFunction(fn, args){
            if (args === 0) {
              return fn;
            }
            if (args === 1) {
              return function(x){
                x = ToNumber(x);
                if (x && x.Completion) {
                  if (x.Abrupt) return x; else x = x.value;
                }
                return fn(x);
              }
            } else if (args === 2) {
              return function(x, y){
                x = ToNumber(x);
                if (x && x.Completion) {
                  if (x.Abrupt) return x; else x = x.value;
                }
                y = ToNumber(y);
                if (y && y.Completion) {
                  if (y.Abrupt) return y; else y = y.value;
                }
                return fn(x, y);
              }
            } else {
              return function(){
                var values = [];
                for (var k in arguments) {
                  var x = arguments[k]
                  if (x && x.Completion) {
                    if (x.Abrupt) return x; else x = x.value;
                  }
                  values.push(x);
                }
                return fn.apply(null, values);
              };
            }
          }

          var funcs = {
            abs: wrapMathFunction(Math.abs, 1),
            acos: wrapMathFunction(Math.acos, 1),
            acosh: wrapMathFunction(function(x){
              return Math.log(x + Math.sqrt(x * x - 1));
            }, 1),
            asinh: wrapMathFunction(function(x){
              return Math.log(x + Math.sqrt(x * x + 1));
            }, 1),
            asin: wrapMathFunction(Math.asin, 1),
            atan: wrapMathFunction(Math.atan, 1),
            atanh: wrapMathFunction(function(x) {
              return .5 * log((1 + x) / (1 - x));
            }, 1),
            atan2: wrapMathFunction(Math.atan2, 2),
            ceil: wrapMathFunction(Math.ceil, 1),
            cos: wrapMathFunction(Math.acos, 1),
            cosh: wrapMathFunction(function(x) {
              if (x < 0) {
                x = -x;
              }
              if (x > 21) {
                return exp(x) / 2;
              } else {
                return (exp(x) + exp(-x)) / 2;
              }
            }, 1),
            exp: wrapMathFunction(Math.exp, 1),
            expm1: wrapMathFunction(function(x) {
              function factorial(x){
                for (var i = 2, o = 1; i <= x; i++) {
                  o *= i;
                }
                return o;
              }

              var o = 0, n = 50;
              for (var i = 1; i < n; i++) {
                o += pow(x, i) / factorial(i);
              }
              return o;
            }, 1),
            floor: wrapMathFunction(Math.floor, 1),
            hypot: wrapMathFunction(function(x, y) {
              return sqrt(x * x + y * y) || 0;
            }, 2),
            log: wrapMathFunction(Math.log, 1),
            log2: wrapMathFunction(function(x){
              return log(x) * (1 / LN2);
            }, 1),
            log10: wrapMathFunction(function(x){
              return log(x) * (1 / LN10);
            }, 1),
            log1p: wrapMathFunction(function(x){
              var o = 0,
                  n = 50;

              if (x <= -1) {
                return -Infinity;
              } else if (x < 0 || value > 1) {
                return log(1 + x);
              } else {
                for (var i = 1; i < n; i++) {
                  if ((i % 2) === 0) {
                    o -= pow(x, i) / i;
                  } else {
                    o += pow(x, i) / i;
                  }
                }
                return o;
              }
            }, 1),
            max: wrapMathFunction(Math.max),
            min: wrapMathFunction(Math.min),
            pow: wrapMathFunction(Math.pow, 2),
            random: wrapMathFunction(Math.random, 0),
            round: wrapMathFunction(Math.round, 1),
            sign: wrapMathFunction(function(x){
              x = +x;
              return x === 0 || x !== x ? x : x < 0 ? -1 : 1;
            }, 1),
            sinh: wrapMathFunction(function(x){
              return (exp(x) - exp(-x)) / 2;
            }, 1),
            sin: wrapMathFunction(Math.sin, 1),
            sqrt: wrapMathFunction(Math.sqrt, 1),
            tan: wrapMathFunction(Math.tan, 1),
            tanh: wrapMathFunction(function(x) {
              return (exp(x) - exp(-x)) / (exp(x) + exp(-x));
            }, 1),
            trunc: wrapMathFunction(function(x){
              return ~~x;
            }, 1)
          };

          return function(){
            var math = new $Object;
            math.NativeBrand = BRANDS.NativeMath;
            for (var i=0; i < consts.length; i++) {
              math.define(consts[i], Math[consts[i]], ___);
            }
            for (var k in funcs) {
              math.define(k, new $NativeFunction({
                call: funcs[k],
                name: k,
                length: funcs[k].length
              }), _CW);
            }
            return math;
          };
        })(Math),

        MapInitialization: CollectionInitializer(MapData, 'Map'),
        MapSigil: function(){
          return MapData.sigil;
        },
        MapSize: function(map){
          return map.MapData ? map.MapData.size : 0;
        },
        MapClear: wrapMapFunction('clear'),
        MapSet: wrapMapFunction('set'),
        MapDelete: wrapMapFunction('remove'),
        MapGet: wrapMapFunction('get'),
        MapHas: wrapMapFunction('has'),
        MapNext: function(map, key){
          var result = map.MapData.after(key);
          return result instanceof Array ? fromInternalArray(result) : result;
        },

        WeakMapInitialization: CollectionInitializer(WeakMapData, 'WeakMap'),
        WeakMapSet: wrapWeakMapFunction('set'),
        WeakMapDelete: wrapWeakMapFunction('remove'),
        WeakMapGet: wrapWeakMapFunction('get'),
        WeakMapHas: wrapWeakMapFunction('has'),
        readFile: function(path, callback){
          require('fs').readFile(path, 'utf8', function(err, file){
            callback.Call(undefined, [file]);
          });
        },
        resolve: module
          ? require('path').resolve
          : function(base, to){
              to = to.split('/');
              base = base.split('/');
              base.length--;

              for (var i=0; i < to.length; i++) {
                if (to[i] === '..') {
                  base.length--;
                } else if (to[i] !== '.') {
                  base[base.length] = to[i];
                }
              }

              return base.join('/');
            },
        baseURL: module ? function(){ return module.parent.parent.dirname }
                        : function(){ return location.origin + location.pathname }
      };
    })();


    var moduleInitScript = new Script({
      scope: SCOPE.GLOBAL,
      natives: true,
      filename: 'module-init.js',
      source: 'import * from "@std";\n'+
              'for (let k in this) {\n'+
              '  let isConstant = typeof this[k] !== "function" && typeof this[k] !== "object";\n'+
              '  Object.defineProperty(this, k, { enumerable: false, configurable: !isConstant, writable: !isConstant });\n'+
              '}'
    });

    var mutationScopeScript = new Script('void 0');

    var emptyClassScript = new Script({
      scope: SCOPE.GLOBAL,
      natives: true,
      filename: 'class-init.js',
      source: '$__EmptyClass = function constructor(...args){ super(...args) }'
    });

    function initialize(realm, ƒ, Ω){
      if (realm.initialized) Ω();
      realm.state = 'initializing';
      realm.initialized = true;
      realm.mutationScope = new ExecutionContext(null, realm.globalEnv, realm, mutationScopeScript.bytecode);
      realm.evaluate(emptyClassScript, true);
      resolveModule(require('../modules')['@system'], realm.global, '@system', ƒ, function(){
        realm.evaluateAsync(moduleInitScript, function(){
          realm.state = 'idle';
          Ω();
        });
      });
    }

    function prepareToRun(bytecode, scope){
      if (!scope) {
        var realm = createSandbox(realm.global);
        scope = realm.globalEnv;
      } else {
        var realm = scope.Realm;
      }
      ExecutionContext.push(new ExecutionContext(null, scope, realm, bytecode));
      var status = TopLevelDeclarationInstantiation(bytecode);
      if (status && status.Abrupt) {
        realm.emit(status.type, status);
        return status;
      }
    }

    function run(realm, thunk, bytecode){
      realm.executing = thunk;
      realm.state = 'executing';
      realm.emit('executing', thunk);

      var result = thunk.run(context);

      if (result === Pause) {
        var resume = function(){
          resume = function(){};
          delete realm.resume;
          realm.emit('resume');
          return run(realm, thunk, bytecode);
        };

        realm.resume = function(){ return resume() };
        realm.state = 'paused';
        realm.emit('pause', realm.resume);
      } else {
        realm.executing = null;
        realm.state = 'idle';
        if (result && result.Abrupt) {
          realm.emit(result.type, result);
        } else {
          realm.emit('complete', result);
        }

        return result;
      }
    }


    function mutationContext(realm, toggle){
      if (toggle === undefined) {
        toggle = !realm.mutating;
      } else {
        toggle = !!toggle;
      }

      if (toggle !== this.mutating) {
        realm.mutating = toggle;
        if (toggle) {
          ExecutionContext.push(realm.mutationScope);
        } else {
          ExecutionContext.pop();
        }
      }
      return toggle;
    }

    function resolveImports(code, ƒ, Ω){
      var modules = create(null);
      if (code.imports && code.imports.length) {
        var load = intrinsics.System.Get('load'),
            count = code.imports.length,
            errors = [];

        var callback = {
          Call: function(receiver, args){
            var result = args[0],
                internals = result.hiddens['loader-internals'];

            if (result instanceof $Module) {
              modules[internals.mrl] = result;
            } else {}

            if (!--count) {
              if (errors.length) {
                ƒ(errors);
              }
              Ω(modules);
            }
          }
        };

        var errback = {
          Call: function(receiver, args){
            errors.push(args[0]);
            if (!--count) {
              ƒ(errors);
              Ω(modules);
            }
          }
        };

        each(code.imports, function(imported){
          if (imported.specifiers && imported.specifiers.Code) {
            var code = imported.specifiers.Code,
                sandbox = createSandbox(global);

            runScript({ bytecode: code }, sandbox, errback.Call, function(){
              var module = new $Module(sandbox.globalEnv, code.ExportedNames);
              var internals = module.hiddens['loader-internals'] = create(null);
              internals.mrl = code.name;
              callback.Call(null, [module]);
            });
          } else {
            var origin = imported.origin;
            if (typeof origin !== STRING && origin instanceof Array) {

            } else {
              load.Call(intrinsics.System, [imported.origin, callback, errback]);
            }
          }
        });
      } else {
        Ω(modules);
      }
    }

    function createSandbox(object){
      var outerRealm = object.Realm || object.Prototype.Realm,
          bindings = new $Object,
          scope = new GlobalEnvironmentRecord(bindings),
          realm = scope.Realm = bindings.Realm = create(outerRealm);

      bindings.NativeBrand = BRANDS.GlobalObject;
      scope.outer = outerRealm.globalEnv;
      realm.global = bindings;
      realm.globalEnv = scope;
      return realm;
    }


    function runScript(script, realm, ƒ, Ω){
      var scope = realm.globalEnv,
          ctx = new ExecutionContext(context, scope, realm, script.bytecode);

      if (!script.thunk) {
        script.thunk = new Thunk(script.bytecode);
      }

      ExecutionContext.push(ctx);
      var status = TopLevelDeclarationInstantiation(script.bytecode);
      context === ctx && ExecutionContext.pop();

      if (status && status.Abrupt) {
        realm.emit(status.type, status);
        return ƒ(status);
      }

      resolveImports(script.bytecode, ƒ, function(modules){
        each(script.bytecode.imports, function(imported){
          var module = modules[imported.origin];

          if (imported.name) {
            scope.SetMutableBinding(imported.name, module);
          } else if (imported.specifiers) {
            iterate(imported.specifiers, function(path, name){
              if (name === '*') {
                module.properties.forEach(function(prop){
                  scope.SetMutableBinding(prop[0], module.Get(prop[0]));
                });
              } else {
                var obj = module;

                each(path, function(part){
                  var o = obj;
                  obj = obj.Get(part);
                });

                scope.SetMutableBinding(name, obj);
              }
            });
          }
        });

        ExecutionContext.push(ctx);
        var result = run(realm, script.thunk, script.bytecode);
        context === ctx && ExecutionContext.pop();
        Ω(result);
      });
    }

    function resolveModule(source, global, name, ƒ, Ω){
      var script = new Script({
        name: name,
        natives: true,
        source: source,
        scope: SCOPE.MODULE
      });

      if (script.error) {
        return ƒ(script.error);
      }

      var sandbox = createSandbox(global);

      runScript(script, sandbox, ƒ, function(){
        Ω(new $Module(sandbox.globalEnv, script.bytecode.ExportedNames));
      });
    }


    function Realm(callback){
      var self = this;

      Emitter.call(this);
      realms.push(this);
      this.active = false;
      this.scripts = [];
      this.templates = {};
      this.state = 'bootstrapping';

      activate(this);
      this.natives = new Intrinsics(this);
      intrinsics = this.intrinsics = this.natives.bindings;
      intrinsics.global = global = this.global = new $Object(new $Object(this.intrinsics.ObjectProto));
      this.global.NativeBrand = BRANDS.GlobalObject;
      globalEnv = this.globalEnv = new GlobalEnvironmentRecord(this.global);
      this.globalEnv.Realm = this;

      this.intrinsics.FunctionProto.Scope = this.globalEnv;
      this.intrinsics.FunctionProto.Realm = this;
      this.intrinsics.ThrowTypeError = CreateThrowTypeError(this);
      hide(this.intrinsics.FunctionProto, 'Scope');
      hide(this, 'intrinsics');
      hide(this, 'natives');
      hide(this, 'active');
      hide(this, 'templates');
      hide(this, 'scripts');
      hide(this, 'globalEnv');

      for (var k in natives) {
        this.natives.binding({ name: k, call: natives[k] });
      }

      this.state = 'initializing';

      function errback(error){
        self.state = 'error';
        callback && callback(error);
        self.emit('error', error);
      }

      initialize(this, errback, function(){
        deactivate(self);
        self.scripts = [];
        self.state = 'idle';
        callback && callback(self);
        self.emit('ready');
      });
      hide(this, 'mutationScope');
      hide(this, 'initialized');
      hide(this, 'quiet');
    }

    inherit(Realm, Emitter, [
      function enterMutationContext(){
        mutationContext(this, true);
      },
      function exitMutationContext(){
        mutationContext(this, false);
      },
      function evaluateModule(source, global, name, errback, callback){
        if (typeof errback !== FUNCTION) {
          if (typeof name === FUNCTION) {
            errback = name;
            name = '';
          } else {
            errback = noop;
          }
        }
        if (typeof callback !== FUNCTION) {
          callback = errback;
          errback = noop;
        }
        resolveModule(source, global, name, errback, callback);
      },
      function evaluateAsync(subject, callback){
        var script = new Script(subject),
            self = this;

        if (script.error) {
          this.emit(script.error.type, script.error);
          return callback(script.error);
        }

        this.scripts.push(script);

        function errback(error){
          callback(error);
          self.emit('error', error);
        }

        runScript(script, this, errback, callback);
      },
      function evaluate(subject){
        activate(this);
        var script = new Script(subject);

        if (script.error) {
          this.emit(script.error.type, script.error);
          return script.error;
        }

        this.scripts.push(script);
        return prepareToRun(script.bytecode, this.globalEnv) || run(this, script.thunk, script.bytecode);
      }
    ]);

    return Realm;
  })();


  function activate(target){
    if (realm !== target) {
      if (realm) {
        realm.active = false;
        realm.emit('deactivate');
      }
      realmStack.push(realm);
      realm = target;
      global = operators.global = target.global;
      intrinsics = target.intrinsics;
      target.active = true;
      target.emit('activate');
    }
  }

  function deactivate(target){
    if (realm === target && realmStack.length) {
      target.active = false;
      realm = realmStack.pop();
      target.emit('dectivate');
    }
  }

  var realms = [],
      realmStack = [],
      realm = null,
      global = null,
      context = null,
      intrinsics = null;



  exports.Realm = Realm;
  exports.Script = Script;
  exports.$NativeFunction = $NativeFunction;

  exports.activeRealm = function activeRealm(){
    if (!realm && realms.length) {
      activate(realms[realms.length - 1]);
    }
    return realm;
  };

  exports.activeContext = function activeContext(){
    return context;
  };

  return exports;
})((0,eval)('this'), typeof module !== 'undefined' ? module.exports : {});





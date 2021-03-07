const request = require("request");
const util = require("util");
const rp = util.promisify(request);
const sleep = util.promisify(setTimeout);
const cheerio = require("cheerio");
const { URL } = require("url");
const { parse } = require("path");
const fs = require("fs");


fs.writeFile("./visited_links.txt", ``, function (err) {
	if (err) {
		return console.error(err);
	}
	console.info("Visited link file was reset!");
});

fs.writeFile("./links_queue.txt", ``, function (err) {
	if (err) {
		return console.error(err);
	}
	console.info("Link queue file was reset!");
});

let seenLinks = new Set();

let linksQueue = [];
const maxCrawlingDepth = 5;
const maxQueueSize = 2000;
const seenLinkLimit = 100;
let mainDomain = null;
let mainParsedUrl = null;

class CreateLink {
	constructor(linkUrl, depth, parent) {
		this.url = linkUrl;
		this.depth = depth;
		this.parent = parent;
		this.children = [];
	}
}

// main entry function

startCrawl("https://github.com/code-knayam/me", 1);

async function startCrawl(url, maxDepth = 5) {
	try {
		mainParsedUrl = new URL(url);
	} catch (e) {
		console.error("Invalid Url", e);
		return;
	}

	mainDomain = mainParsedUrl.hostname;

	startLink = new CreateLink(url, 0, null);
	console.info("Started Scrapping");
	await findLinks(startLink);
}

async function crawl(linkObj) {
	if (
		seenLinks.size > seenLinkLimit ||
		linksQueue.length === 0 ||
		linksQueue.length > maxQueueSize
	) {
		console.info("Finished Scrapping");

		console.info("Started dumpping output to file");
		
		addSeenLinksToFile();
		addLinksQueueToFile();
		
		console.info("Finished dump");
		return;
	}

	await findLinks(linkObj);
}

async function findLinks(linkObj) {
	const urlToLoad = linkObj.url;
	
	try {
		response = await rp(urlToLoad);

		console.debug(linksQueue.length, seenLinks.size)

		if (response.statusCode !== 200) {
			console.info('Status error')
			crawl(getNextLink());
			return;
		}

		if (linkObj.depth > maxCrawlingDepth) {
			console.info('Max depth')
			crawl(getNextLink());
			return;
		}

		let $ = cheerio.load(response.body);

		let links = $("body")
			.find("a")
			.filter(function (i, el) {
				return $(this).attr("href") != null;
			})
			.map(function (i, x) {
				return $(this).attr("href");
			});
		if (links.length > 0) {
			links = links
				.map((_, link) => {
					const parsedLink = checkUrl(link);
					if (parsedLink) {
						link = new CreateLink(link, linkObj.depth + 1, linkObj);
						return link;
					}
					return null;
				})
				.filter(Boolean);
		} else {
			console.info("No more links found for " + urlToLoad);
		}

		addToLinksQueue(links);
		addToVisitedLink(urlToLoad);

		crawl(getNextLink());
	} catch (e) {
		console.error(e);
		return;
	}
}

function checkUrl(url) {
	let parsedUrl;

	try {
		parsedUrl = new URL(url);
		if (parsedUrl.hostname !== mainDomain) {
			parsedUrl = false;
		}
	} catch (e) {
		parsedUrl = false;
	}

	return parsedUrl;
}

function addToLinksQueue(links) {
	for (let i = 0; i < links.length; i++) {
		const link = links[i];
		if (!seenLinks.has(link)) {
			linksQueue.push(link);
		}
	}
}

function addToVisitedLink(link) {
	seenLinks.add(link);
}

function getNextLink() {
	return linksQueue.shift();
}

function isWatchVideo(parsedLink) {
	return parsedLink.searchParams['v'] && parsedLink.pathname === 'watch';
}

function addSeenLinksToFile() {
	for (let link of seenLinks) {
		fs.appendFile("./visited_links.txt", `${link} \n`, function (err) {
			if (err) {
				return console.error(err);
			}
		});
	}
}

function addLinksQueueToFile() {
	for (let link of linksQueue) {
		fs.appendFile("./links_queue.txt", `${link.url} \n`, function (err) {
			if (err) {
				return console.error(err);
			}
		});
	}
}

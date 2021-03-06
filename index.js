const request = require("request");
const util = require("util");
const rp = util.promisify(request);
const sleep = util.promisify(setTimeout);
const cheerio = require("cheerio");
const { URL } = require("url");
const { parse } = require("path");

let seenLinks = new Set();

let linksQueue = [];
let maxCrawlingDepth = 5;

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

startCrawl("https://www.youtube.com/", 1);

async function startCrawl(url, maxDepth = 5) {
	try {
		mainParsedUrl = new URL(url);
	} catch (e) {
		console.log("Invalid Url", e);
		return;
	}

	mainDomain = mainParsedUrl.hostname;

	startLink = new CreateLink(url, 0, null);

    await findLinks(startLink);
}

async function crawl(linkObj) {
	if (
		seenLinks.size > 50 ||
		linksQueue.length === 0 ||
		linksQueue.length > 1000
	) {
		console.log(seenLinks);
		return;
	}
	await findLinks(linkObj);
}

async function findLinks(linkObj) {
	const urlToLoad = linkObj.url;
	try {
		response = await rp(urlToLoad);

		if (response.statusCode !== 200) {
			return;
		}

		if (linkObj.depth > maxCrawlingDepth) {
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
			console.log("No more links found for " + urlToLoad);
		}

		addToLinksQueue(links);
		addToVisitedLink(urlToLoad);

		crawl(getNextLink());
	} catch (e) {
		console.log(e);
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

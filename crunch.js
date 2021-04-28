const https = require('https');
const parseComments = require('parse-html-comments');
const queryObj = {"mapBounds":{"west":-87.26304163353697,"east":-84.04954065697447,"south":39.62947398094314,"north":41.30719754188256},"isMapVisible":true,"filterState":{"price":{"min":0},"mp":{"min":0},"ah":{"value":true},"con":{"value":false},"manu":{"value":false},"land":{"value":false},"tow":{"value":false},"apa":{"value":false},"apco":{"value":false}},"isListVisible":true,"mapZoom":11};
const cheerio = require('cheerio');
const baseUrl = 'https://www.zillow.com/fort-wayne-in/?searchQueryState=';

var cmdArgs = process.argv.slice(2);
var allListings = {};

function get(url, data, resp) {
    https.get(url, (res) => {
        var pageData = '';
        
        res.on('data', (d) => {
            pageData += d;
        });

        res.on('close', function(){
            (resp || data)(pageData, data);
        });

        }).on('error', (e) => {
        // console.error(e);
    });
}

function getArgVal(arg) {
    return cmdArgs[cmdArgs.indexOf(arg) + 1];
}

function int(num) {
    return parseInt(num);
}

function parseCurl(curlData) {
    parseComments(curlData).matches.forEach(element => {
        try {
            var comment = element.groups.commentOnly,
                parseComment = JSON.parse(comment.substr(4, comment.length - 7)),
                category = Object.keys(parseComment).toString().match(/cat[1-2]/)[0],
                listings = parseComment[category].searchResults.listResults;

            listings.forEach((listing, idx) => {
                var taxValue = listing.hdpData.homeInfo.taxAssessedValue,
                    price = listing.unformattedPrice;

                if (price && taxValue && taxValue > price) {
                    allListings[listing.id] = {id: listing.id, url: listing.detailUrl, price: price, taxValue: taxValue, taxPriceDiff: (taxValue - price)};

                    get(listing.detailUrl, {id: listing.id}, function(listingHTML, data) {
                        var yearBuilt = int(parseProperty('yearBuilt', listingHTML)),
                            listingId = allListings[data.id],
                            price = listingId.price,
                            logThis = true;

                        if (yearBuilt && !isNaN(yearBuilt) && price) {
                            listingId['yearBuilt'] = yearBuilt;

                            if (cmdArgs.length) {
                                if (cmdArgs.includes('--minYearBuilt') && yearBuilt && (yearBuilt < int(getArgVal('--minYearBuilt'))) ) {
                                    logThis = false;
                                }
    
                                if (logThis && cmdArgs.includes('--maxPrice') && (price > int(getArgVal('--maxPrice')))) {
                                    logThis = false;
                                }
    
                                if (logThis && cmdArgs.includes('--minPrice') && (price < int(getArgVal('--minPrice')))) {
                                    logThis = false;
                                }
    
                                if (logThis && cmdArgs.includes('--minPriceDiff') && (listingId.taxPriceDiff < int(getArgVal('--minPriceDiff')))) {
                                    logThis = false;
                                }
                            }
                        } else {
                            logThis = false;
                        }

                        if (logThis) {
                            console.log(listingId);
                        }
                    });
                }
            });
        } catch(e) {
            // JSON.parse failed
        }
    });
}

function parseProperty(property, html) {
    var propRegEx = new RegExp('"' + property + '[\\\\]?":([a-z|0-9]+)[,]?'),
        propMatch = html.match(propRegEx);

    if (propMatch) {
        return propMatch[1];
    }
}

function queryCategory(catNum) {
    // <li aria-current="page" class="PaginationReadoutItem-c11n-8-27-0__sc-18an4gi-0 bzMGTy">
    get(baseUrl + encodeURIComponent(JSON.stringify({ ...queryObj, ...{"category":"cat" + catNum, "pagination":{"currentPage": 1}} })), function(html) {
        const $ = cheerio.load(html);
        const pageTotal = int($('li[aria-current="page"][class^="PaginationReadoutItem"]').children().text().split('Page 1 of ')[1]);

        parseCurl(html);

        if (pageTotal > 1) {
            for (var i = 2; i <= pageTotal; i++) {
                get(baseUrl + encodeURIComponent(JSON.stringify({ ...queryObj, ...{"category":"cat" + catNum, "pagination":{"currentPage": i}} })), function(html) {
                    parseCurl(html);
                });
            }
        }
    });
}

queryCategory(1);
queryCategory(2);





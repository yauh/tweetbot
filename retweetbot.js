if (Meteor.isServer) {
    Fiber = Npm.require('fibers');
    console.log('*** Server running ***');
    ProcessedTweets = new Meteor.Collection('processedTweets');
    var hashtag = 'meteorjob'; // these are the droids we're looking for
    var checkInterval = 60000; // how much time to wait between checks
    var lastTweetId = 452841670879748100; // the birth of the bot

    // remember the last tweet you actually processed and stored in mongo
    if (ProcessedTweets.find().count()) {
        lastTweetId = ProcessedTweets.findOne({}, {sort: {lastTweetId: -1}}).lastTweetId;
    };

    // hey, use your own Twitter application https://apps.twitter.com
    // make sure to give read + write permissions before creating the token!!
    Twit = new TwitMaker({
        consumer_key: '',
        consumer_secret: '',
        access_token: '',
        access_token_secret: ''
    });
    console.log('Getting to work with Id ' + lastTweetId);

    // the magic happens regularily
    Meteor.setInterval(function () {
        processTweets(hashtag, lastTweetId);
    }, checkInterval);

    function processTweets(hashtag, id) {
        var now = new Date();
        timestamp = strDateTime = [[now.getDate(), now.getMonth(+1), now.getFullYear()].join("/"), [now.getHours(), now.getMinutes()].join(":"), now.getHours() >= 12 ? "PM" : "AM"].join(" ");
        console.log('*** Running ' + timestamp + ' ***');

        var searchResults = Twit.get(
            'search/tweets',
            {
                q: hashtag + ' since_id:' + id
            },
            function (err, reply) {
                tweets = reply.statuses.reverse();
                console.log('Found ' + tweets.length + ' new tweets since Id ' + id);
                for (var i = 0; i < tweets.length; i++) {
                    var retweetRegex = /^RT/;
                    var ignored_users = ["meteorjobs"];

                    // don't care about Retweets
                    if (retweetRegex.test(tweets[i].text)) {
                        console.log('skipping a retweet by ' + tweets[i].user.screen_name);
                        continue;
                    }

                    // don't retweet these people
                    if (ignored_users.indexOf(tweets[i].user.screen_name) > -1 ) {
                        console.log('ignoring a tweet by ' + tweets[i].user.screen_name);
                        continue;
                    }

                    // retweet proper matches with the screen_name and text
                    var tweetThis = 'RT ' + '@' + tweets[i].user.screen_name + ' ' + tweets[i].text;

                    // don't forget - only 140 chars allowed
                    if (tweetThis.length > 140) {
                        var tweetThis = tweetThis.substring(0, 137) + '...';
                    }

                    // for safety reasons you need to uncomment the Twit.post and closing brackets
                    //Twit.post('statuses/update', { status: tweetThis }, function(err, reply) {
                        console.log('I tweet this: ' + tweetThis);
                        id = parseInt(id)+1;
                    //})

                    if (parseInt(tweets[i].id) > parseInt(lastTweetId)) {
                        lastTweetId = tweets[i].id;
                        Fiber(function () {
                            id = ProcessedTweets.insert({lastTweetId: lastTweetId.toString(),
                                twitter_handle: tweets[i].user.screen_name,
                                text: tweets[i].text});
                            console.log('insert Id ' + lastTweetId + ' into database');
                        }).run();
                    }
                }
            }
        );
    }
}

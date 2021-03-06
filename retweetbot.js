if (Meteor.isServer) {
  // configuration settings
  var hashtag = 'meteorjob'; // these are the droids we're looking for
  var checkInterval = 100000; // how much time to wait between checks for new tweets
  var lastTweetId = 594129359583244288; // re-launch in May 2015

  // inserts require fibers
  Fiber = Npm.require('fibers');
  ProcessedTweets = new Meteor.Collection('processedTweets');

  console.log('*** Server running ***');

  // hey, use your own Twitter application https://apps.twitter.com
  // make sure to give read + write permissions before creating the token!!
  Twit = new TwitMaker({
    consumer_key: 'CONSUMER_KEY',
    consumer_secret: 'CONSUMER_SECRET',
    access_token: 'ACCESS_TOKEN',
    access_token_secret: 'ACCESS_TOKEN_SECRET'
  });
  console.log('Getting to work with Id ' + lastTweetId);

  // the magic happens regularily
  var getLatestTweets = function () {
    if (ProcessedTweets.find().count()) {
      lastTweetId = ProcessedTweets.findOne({}, {
        sort: {
          lastTweetId: -1
        }
      }).lastTweetId;
    };
    processTweets(hashtag, lastTweetId);
  };

  /**
   * Crops text of a tweet at the end of any non-link text part.
   *   Prevents crops like http://t.co/abc… (which don't parse to
   *   links on twitter)
   * @author  bobbigmac
   * @param  {string} text   Full tweet text as you would like to post it
   * @param  {number} length Maximum length of tweet (usually 140-160)
   * @return {string}        Full tweet text as you should post it
   */
  var shortenBeforeLink = function (text, length) {
    var endLinkRegex = /^(.*)\s(https?:\/\/[^\s]+){1,}\s*$/gi;
    //this regex could also probably be modified to not crop @names or #hastags

    var parts = endLinkRegex.exec(text);
    if (parts && parts.length > 2) {
      var endLink = parts[2];
      console.log('long tweet before:', text.length, text);

      text = shortenBeforeLink((parts[1] + ''), length - (endLink.length + 1)).trim();
      if (text.indexOf('…') === -1) {
        text += '… '
      }
      text += ' ' + endLink;

      console.log('long tweet after:', text.length, text);
    } else {
      text = text.substring(0, length - 2).trim() + '… ';
    }
    return text;
  }

  var processTweets = function (hashtag, id) {
    // helper for generating a nicer timestamp
    var now = new Date();
    timestamp = strDateTime = [
      [now.getDate(), now.getMonth(+1), now.getFullYear()].join("/"), [now.getHours(), now.getMinutes()].join(":"), now.getHours() >= 12 ? "PM" : "AM"
    ].join(" ");
    console.log('*********************************');
    console.log('** Processing at ' + timestamp + ' **');

    var searchResults = Twit.get(
      'search/tweets', {
        q: hashtag + (id ? ' since_id:' + id : '')
      },
      function (err, reply) {
        tweets = (reply && reply.statuses && reply.statuses.reverse()) || [];
        console.log('Found ' + tweets.length + ' new tweets since Id ' + id);
        for (var i = 0; i < tweets.length; i++) {
          var retweetRegex = /^\s*RT\s*@/;
          var ignored_users = ["meteorjobs", "meteorjob"];

          console.log('** User ** ' + tweets[i].user.screen_name);
          console.log('** Id   **' + tweets[i].id);
          console.log('** Text **' + tweets[i].text);
          console.log('Insert Id ' + lastTweetId + ' into database');
          storeTweet(tweets[i].id, tweets[i].user.screen_name, tweets[i].text);

          // don't care about Retweets
          if (retweetRegex.test(tweets[i].text)) {
            console.log('skipping a retweet by ' + tweets[i].user.screen_name);
            continue;
          }

          // don't retweet these people
          if (ignored_users.indexOf(tweets[i].user.screen_name) > -1) {
            console.log('ignoring the user ' + tweets[i].user.screen_name);
            continue;
          }

          // retweet proper matches with the screen_name and text
          var tweetThis = 'RT ' + '@' + tweets[i].user.screen_name + ' ' + tweets[i].text;

          // don't forget - only 140 chars allowed
          if (tweetThis.length > 140) {
            tweetThis = shortenBeforeLink(tweetThis, 140);
          }

          // for safety reasons you need to uncomment the Twit.post and closing brackets
          //Twit.post('statuses/update', {
            status: tweetThis
          //}, function (err, reply) {
            console.log('I tweet this: ' + tweetThis);
          //})
        }
      }
    );

    function storeTweet(id, user, text) {
      Fiber(function () {
        var storedTweet = ProcessedTweets.insert({
          lastTweetId: id.toString(),
          twitter_handle: user,
          text: text
        });
        console.log('inserted ' + id);
      }).run();
    }
  }

  //first run (want to run immediately on start)
  getLatestTweets();
  Meteor.setInterval(getLatestTweets, checkInterval);
}

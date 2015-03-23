if (Meteor.isServer)
{
  // configuration settings
  var hashtag = 'meteorjob'; // these are the droids we're looking for
  var checkInterval = 100000; // how much time to wait between checks for new tweets
  var lastTweetId = 579705482975146000; // re-launch with 1.0.4

  // inserts require fibers
  Fiber = Npm.require('fibers');
  ProcessedTweets = new Meteor.Collection('processedTweets');

  console.log('*** Server running ***');

  // hey, use your own Twitter application https://apps.twitter.com
  // make sure to give read + write permissions before creating the token!!
  Twit = new TwitMaker(
  {
    consumer_key: 'key',
    consumer_secret: 'secret',
    access_token: 'token',
    access_token_secret: 'token-secret'
  });
  console.log('Getting to work with Id ' + lastTweetId);

  // the magic happens regularily
  Meteor.setInterval(function()
  {
    if (ProcessedTweets.find().count())
    {
      lastTweetId = ProcessedTweets.findOne(
      {},
      {
        sort:
        {
          lastTweetId: -1
        }
      }).lastTweetId;
    };
    processTweets(hashtag, lastTweetId);
  }, checkInterval);

  function processTweets(hashtag, id)
  {
    // helper for generating a nicer timestamp
    var now = new Date();
    timestamp = strDateTime = [
      [now.getDate(), now.getMonth(+1), now.getFullYear()].join("/"), [now.getHours(), now.getMinutes()].join(":"), now.getHours() >= 12 ? "PM" : "AM"
    ].join(" ");
    console.log('*********************************');
    console.log('** Processing at ' + timestamp + ' **');

    var searchResults = Twit.get(
      'search/tweets',
      {
        q: hashtag + ' since_id:' + id
      },
      function(err, reply)
      {
        tweets = reply.statuses.reverse();
        console.log('Found ' + tweets.length + ' new tweets since Id ' + id);
        for (var i = 0; i < tweets.length; i++)
        {
          var retweetRegex = /^RT/;
          var ignored_users = ["meteorjobs", "meteorjob"];

          console.log('** User ** ' + tweets[i].user.screen_name);
          console.log('** Id   **' + tweets[i].id);
          console.log('** Text **' + tweets[i].text);
          console.log('Insert Id ' + lastTweetId + ' into database');
          storeTweet(tweets[i].id, tweets[i].user.screen_name, tweets[i].text);

          // don't care about Retweets
          if (retweetRegex.test(tweets[i].text))
          {
            console.log('skipping a retweet by ' + tweets[i].user.screen_name);
            continue;
          }

          // don't retweet these people
          if (ignored_users.indexOf(tweets[i].user.screen_name) > -1)
          {
            console.log('ignoring the user ' + tweets[i].user.screen_name);
            continue;
          }

          // retweet proper matches with the screen_name and text
          var tweetThis = 'RT ' + '@' + tweets[i].user.screen_name + ' ' + tweets[i].text;

          // don't forget - only 140 chars allowed
          if (tweetThis.length > 140)
          {
            var tweetThis = tweetThis.substring(0, 137) + '...';
          }

          // for safety reasons you need to uncomment the Twit.post and closing brackets
          //Twit.post('statuses/update',{ status: tweetThis }, function(err, reply) {
          console.log('I tweet this: ' + tweetThis);
          //})


        }
      }
    );

    function storeTweet(id, user, text)
    {
      Fiber(function()
      {
        var storedTweet = ProcessedTweets.insert(
        {
          lastTweetId: id.toString(),
          twitter_handle: user,
          text: text
        });
        console.log('inserted ' + id);
      }).run();
    }
  }
}
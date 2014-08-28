$(function() {

	window.my_divvy_data = [];
  var total_trips = 0;
  window.calculating = false;
  window.showing_sidebar = true;
  window.posted_to_leaderboard = false;
  window.time_in_seconds = 0;
  window.small_trips = 0;
  window.one_trip_month = false;
  window.zero_trips_month = false;
  window.month_names = ["January", "February", "March", "April", "May", "June", "July","August", "September", "October", "November", "December"]
  window.years = ["2013", "2014", "2015", "2016"]

   // Finding which month/year page we're on
  var time_range = $(".small-7.columns>h2").text();    // Not the most stable way to find which month we're on but fine for now
  for (var i = 0; i <= 11; i++) {
    if (time_range.indexOf(window.month_names[i]) != -1) {
      window.this_month = window.month_names[i];
    }
  }
  for (var i = 0; i <= 3; i++) {
    if (time_range.indexOf(window.years[i]) != -1) {
      window.this_year = window.years[i];
    }
  }

  // Scrape the trips info table
  function scrapeDivvyData() {
    $('tbody').children().each(function() {
      row = $(this).children();
      var trip_id = row.eq(0).text();
      var start_station = row.eq(1).text();
      var start_date = row.eq(2).text();
      var end_station = row.eq(3).text();
      var end_date = row.eq(4).text();
      var duration = row.eq(5).text();
      var trip_data = { "trip_id" : trip_id, "start_station" : start_station, "start_date" : start_date, "end_station" : end_station, "end_date" : end_date, "duration" : duration };
      window.my_divvy_data.push(trip_data);
    });
    if (window.my_divvy_data.length > 1){
      window.extra_unique_id = parseInt(window.my_divvy_data[window.my_divvy_data.length-1]["trip_id"].substr(3,5) + window.my_divvy_data[window.my_divvy_data.length-2]["trip_id"].substr(3,5) + window.my_divvy_data[window.my_divvy_data.length-3]["trip_id"].substr(3,5));
    }else if (window.my_divvy_data.length == 1){
      if (window.my_divvy_data[0].start_station!=""){
        window.extra_unique_id = parseInt(window.my_divvy_data[0]["trip_id"].substr(3,4) + String(Math.random()).substr(2, 4)); //// CHECK THIS!!!
        window.one_trip_month = true;
      } else {
        window.zero_trips_month = true;
      }
    }
  }
  scrapeDivvyData();

  function roundTenths(number) {
    return parseInt(number * 10) / 10
  }

  // Create Divvybrags sidebar menu
  content_html = "<br/><div id='divvybrags'>";
  content_html += "<div id='toggle-divvybrags'>X</div><br/><br/>";
  content_html += "<div id='divvybrags-body'>";
  content_html += "<h2>DivvyBrags</h2><br/><br/>";
  if (window.one_trip_month == false && window.zero_trips_month == false){
    var loader_img = chrome.extension.getURL("ajax-loader.gif");    // Loading gif animation
    content_html += "<p id='calculate-my-milage' class='divvybrags-option'><img id='loading-gif' src='" + loader_img + "'>&nbsp;Calculating Mileage</p>";
    content_html += "<p id='milage-note'></p>";
    content_html += "<p id='brag-toggle' class='divvybrags-option'>Brag</p>";
    content_html += "<p id='brag-area'></p>";
    content_html += "<p id='make-chart' class='divvybrags-option'>Chart My Data</p>";
    content_html += "<p id='download-csv' class='divvybrags-option'>Download as CSV</p>";
    content_html += "<p id='chart-making-status'></p>";
    content_html += "<p id='leaderboard-toggle' class='divvybrags-option'>The Leaderboard</p>";
    content_html += "<p id='leaderboard'></p>";
  } else if (window.one_trip_month == true) {
    content_html += "<br/><br/><h5>You only took one trip this month.<br/><br/>Not much to brag about, honestly. </h5>";
  } else if (window.zero_trips_month == true){
    content_html += "<br/><br/><h5>You didn't take any trips this month.</h5>";
    content_html += "<br/><br/><br/><h2 style ='font-size: 50px'>&#9785;</h2>"; //sad face
  }
  content_html += "</div></div>";

  $('#content').after(content_html);

  $('table').before("<div id='chart-area'></div><div id='chart-area-margin'></div>");

  window.total_milage = 0;
  window.trips_calculated = 0;

  function checkUserID() {
    chrome.storage.sync.get('extra_unique_id', function(result) {
      if (result === null) {
        var my_extra_unique_id = Math.random().toString(36).substring(7);
        // Save id using Chrome extension storage.
        chrome.storage.sync.set({'extra_unique_id': my_extra_unique_id}, function() {});
      }
    });
  }
  checkUserID();

  var station_distances_url = chrome.extension.getURL("station_distances_by_bicycle.csv");

  // Pull in the big CSV of Divvy distances. Thanks Nick Bennett for building this! :)
  $.ajax({
      type: "GET",
      url: station_distances_url,
      dataType: "text",
      success: function(data) {
        processData(data);
        // Next we'll go retrieve the leaderboard
        $.ajax({
          type: "GET",
          url: "http://divvybrags-leaderboard.herokuapp.com/entries.json?city=Chicago",
          success: function(data) {
            leaderboard_html = "";
            var leaderboard = data
            for (var i = 0; i <= leaderboard.length - 1; i++) {
              var month = leaderboard[i];
              var month_name = Object.keys(month);
              leaderboard_html += "<h5 style='font-style: italic;'>" + month_name + "</h5><br/>";
              for (var k = 0; k < month[month_name].length; k++) {
                var leaderboard_entry = month[month_name][k];
                var rank = Object.keys(leaderboard_entry);
                var name = leaderboard_entry[rank]["name"];
                var miles = leaderboard_entry[rank]["miles"];
                leaderboard_html += "<h10>" + rank + ". " + name + ": " + miles + "mi</h10><br/>";
              }
              leaderboard_html += "<br/>"
            }
            $("#leaderboard").html(leaderboard_html);
          }
        });
      }
   });

  // This runs automatically once data is loaded
  function calculateMyMilage() {
    if (window.calculating === false) {
      window.calculating = true;
      var loader_img = chrome.extension.getURL("ajax-loader.gif");              // Create loading gif animation
      $('#calculate-my-milage').append("<img id='loading-gif' src='" + loader_img + "'>");
      for (var i = 0; i < window.my_divvy_data.length; i++) {
        var csv_response = getMilageFromCSV(window.my_divvy_data[i], i);            // Check to see if the stations are in the CSV
        if (csv_response === false) {
          google_response = getMilageFromGoogle(window.my_divvy_data[i], i);    // If not, ask Google for distances
          if (google_response === false) {
            handleNoMilageRow(i)                                                // If Google's clueless, no miles for you
          }
        }
      }
    }
  };

  function getMilageFromCSV(trip, i) {
    var start_station = trip["start_station"];
    var end_station = trip["end_station"];

    // Extracting + parsing info about trip durations
    var duration = trip["duration"].split(" ");
    for (var j = 0; j < duration.length; j++) {
      var this_trip_seconds = 0;
      if (duration[j].indexOf("s") !== -1) {
        var seconds = parseInt($.trim(duration[j]).substring(0, $.trim(duration[j]).length - 1));
        this_trip_seconds += seconds
        window.time_in_seconds += seconds
      }
      if (duration[j].indexOf("m") !== -1) {
        var minutes = parseInt($.trim(duration[j]).substring(0, $.trim(duration[j]).length - 1)) * 60;
        this_trip_seconds += minutes
        window.time_in_seconds += minutes
      }
      if (duration[j].indexOf("h") !== -1) {
        var hours = parseInt($.trim(duration[j]).substring(0, $.trim(duration[j]).length - 1)) * 3600;
        this_trip_seconds += hours
        window.time_in_seconds += hours
      }
    }

    // Extracting + parsing info about distance
    if (start_station !== end_station) {
      window.match_found = false;
      for (k = 0; k < window.lines.length; k++) {
        var this_pair = window.lines[k];
        if (this_pair["start_station"] === start_station && this_pair["end_station"] === end_station) {
          var milage = parseFloat(this_pair["distance"] * 0.000621371);   // Distances in the CSV are stored as meters, so convert them to miles here
          window.my_divvy_data[i]["milage"] = milage;
          window.total_milage += milage;
          window.trips_calculated += 1;
          window.match_found = true;
          $('#milage-note').html(String(window.trips_calculated) + " out of " + String(window.my_divvy_data.length) + " trips calculated.");
          // When there are no more trips to calculate, post the results in the notice area of the Divvybrags sidebar
          if (trips_calculated === window.my_divvy_data.length) {
            postResults(window.total_milage);
          }
        }
      }
      if (window.match_found === false) {
        return false          // Pass to Google Distance API since these station names aren't in the CSV file
      }
    } else {
      if (this_trip_seconds < 60) {
        window.small_trips += 1       // If the trip is under one minute and the start/end stations are the same, it's a "small trip"
      }
      handleNoMilageRow(i)    // No milage for this trip if the start station is the same as the end station
    }
  }

  function handleNoMilageRow(i) {
    window.my_divvy_data[i]["milage"] = 0;
    window.trips_calculated += 1;
    $('#milage-note').html(String(window.trips_calculated) + " out of " + String(window.my_divvy_data.length) + " trips calculated.");
    if (window.trips_calculated === window.my_divvy_data.length) {
      postResults(window.total_milage);
    }
  }

  // This function describes how to ask the Google Distance API for approximate trip distances
  function getMilageFromGoogle(trip, i) {

    // There are a few station locations that Google doesn't parse well -- swap those out for more precise addresses
    if (trip["start_station"] !== "Theater on the Lake" && trip["start_station"] !== "Daley Center Plaza") {
      start = trip["start_station"].replace(/\s/g, "+").replace(/&/,"and") + "+Chicago,+IL,+USA";
    } else if (trip["start_station"] === "Theater on the Lake") {
      start = "2401+N+Lake+Shore+Dr,+Chicago,+IL,+USA";
    } else if (trip["start_station"] === "Daley Center Plaza") {
      start = "50+W+Washington+St,+Chicago,+IL,+USA";
    }
    if (trip["end_station"] !== "Theater on the Lake" && trip["end_station"] !== "Daley Center Plaza") {
      end = trip["end_station"].replace(/\s/g, "+").replace(/&/,"and") + "+Chicago,+IL,+USA";
    } else if (trip["end_station"] === "Theater on the Lake") {
      end = "2401+N+Lake+Shore+Dr,+Chicago,+IL,+USA";
    } else if (trip["end_station"] === "Daley Center Plaza") {
      end = "50+W+Washington+St,+Chicago,+IL,+USA";
    }

    google_url = "https://maps.googleapis.com/maps/api/distancematrix/json?origins=" + start + "&destinations=" + end + "&sensor=false&mode=bicycling&units=imperial"
    $.ajax({
      type: "POST",
      url: google_url,
      success: function(data) {
        if (data.status === "OK") {
          response = data["rows"][0]["elements"][0]["distance"]["text"]
          if (response.indexOf("ft") === -1) {
            milage = parseFloat(response.replace(/\s/g, "").replace(/mi/g, ""));
          } else {
            milage = parseFloat(response.replace(/\s/g, "").replace(/ft/g, "") / 5280);
          }
          if (milage < 20) {                            // Sanity check in case Google wildly mis-reads the location of a Divvy station based on its name.
            window.my_divvy_data[i]["milage"] = milage;
            total_milage += milage;
            trips_calculated += 1;
            $('#milage-note').html(String(trips_calculated) + " out of " + String(window.my_divvy_data.length) + " trips calculated.");
            // When there are no more trips to calculate, post the results in the notice area of the Divvybrags sidebar
            if (trips_calculated === window.my_divvy_data.length) {
              postResults(total_milage);
            }
          } else {
            return false
          }
        }
        // If the Google API says we're over the query limit, keep trying until we're not
        if (data.status === "OVER_QUERY_LIMIT") {
          if (data.error_message !== "You have exceeded your daily request quota for this API.") {
            getMilageFromGoogle(trip, i);
          } else {
            $('#milage-note').html("Google Distance Matrix daily limit reached, try again tomorrow. :(");
            $('#loading-gif').remove()
            return false
          }
        }
        if (data.status === "REQUEST_DENIED" || data.status === "MAX_ELEMENTS_EXCEEDED") {
          return false
        }
      }
    });
  };

  // Display milage results in the sidebar
  function postResults(total_milage) {
    window.total_milage = roundTenths(total_milage);
    window.number_of_trips = window.my_divvy_data.length - window.small_trips;
    window.total_hours = Math.floor(window.time_in_seconds/3600);
    window.remainder_minutes = Math.floor((window.time_in_seconds % 3600)/60);
    window.remainder_seconds = (window.time_in_seconds % 3600) % 60;
    notice_area_html = "<p class='notice-area-text'>Number of trips: " + window.number_of_trips;
    if (window.small_trips > 0) {
      notice_area_html += "*"
    }
    notice_area_html += "</p><p class='notice-area-text'>Time Divvying: " + window.total_hours + "h, " + window.remainder_minutes + "m, " + window.remainder_seconds + "s</p>";
    notice_area_html += "<p class='notice-area-text'>Approximate distance traveled: <span id='total-milage'>" + window.total_milage + "</span>mi</p>";
    $('#calculate-my-milage').html("My "+ window.this_month +" stats");
    $('#calculate-my-milage').attr("style","text-decoration: underline;");
    $('#calculate-my-milage').after(notice_area_html);
    if (window.small_trips > 0) {
      var milage_note_html = "* There are " + window.my_divvy_data.length + " rows in your data table, but ";
      milage_note_html += window.small_trips + " of these are micro-trips under 60 seconds.";
      $('#milage-note').html(milage_note_html);
    }
    $('#loading-gif').remove();
    window.milage_calculated = true;
    makeChart();        // Create the chart when we post results!
  }

  // Read the big CSV file of distances and store in window.lines
  function processData(allText) {
    var allTextLines = allText.split(/\r\n|\n/);
    var headers = allTextLines[0].split(',');
    var lines = [];

    for (var i = 1; i < allTextLines.length; i++) {
        var data = allTextLines[i].split(',');
        if (data.length == headers.length) {
            var tarr = {};
            for (var j = 0; j < headers.length; j++) {
                tarr[headers[j]] = data[j];
            }
            lines.push(tarr);
        }
    }
    window.lines = lines;
    calculateMyMilage();
  }

  Date.prototype.addDays = function(days) {
    var dat = new Date(this.valueOf())
    dat.setDate(dat.getDate() + days);
    return dat;
  }

  function getDates(startDate, stopDate) {
    var dateArray = new Array();
    var currentDate = startDate;
    while (currentDate <= stopDate) {
        dateArray.push( new Date (currentDate) )
        currentDate = currentDate.addDays(1);
    }
    return dateArray;
  }

  function makeChart() {
    var additive_milage_array = [];
    var daily_milage_array = [];
    var cumulative_milage_array = [0];
    var dates_with_trips = [];
    var last_cumulative_miles = 0;
    var milage_calculated = false;

    for (var i = 0; i < window.my_divvy_data.length; i++) {
      if (window.my_divvy_data[i]["milage"] !== undefined) {
        milage_calculated = true;
      }
    }

    if (milage_calculated === false) {
      $('#chart-making-status').html("Please calculate your milage first. We'll use that data to create a chart for you.");
      return
    }

    // Generating an array with all the dates between user's first Divvy ride and user's most recent Divvy ride
    first_date = parseDate(window.my_divvy_data[window.my_divvy_data.length - 1]["start_date"]);
    last_date = parseDate(window.my_divvy_data[0]["start_date"]);
    date_array = getDates(first_date, last_date);

    function parseDate(aDate){
      aDate = aDate.split(' ')[0]
      aDate = new Date(aDate)
      return aDate
    }

    // Stuff arrays with data representing daily trip miles and cumulative trip miles...
    for (var j = 0; j < date_array.length; j++) {
      milage_present = false;

      // Check to see if the user took bike rides on any given day. If so, add up miles
      for (var i = 0; i < window.my_divvy_data.length; i++) {
        trip = window.my_divvy_data[i];
        this_trip_date = parseDate(trip["start_date"]);
        if (this_trip_date.getTime() === date_array[j].getTime()) {
          milage_present = true;
          if (dates_with_trips.indexOf(this_trip_date.getTime()) === -1) {
            dates_with_trips.push(this_trip_date.getTime());
            daily_milage_array.push(roundTenths(trip["milage"]));
            last_cumulative_miles = cumulative_milage_array[cumulative_milage_array.length -1]
            cumulative_milage_array.push(last_cumulative_miles + roundTenths(trip["milage"]));

          } else {
            daily_milage_array[daily_milage_array.length - 1] = roundTenths(trip["milage"] + daily_milage_array[daily_milage_array.length - 1])
            cumulative_milage_array[cumulative_milage_array.length -1] = roundTenths(trip["milage"] + cumulative_milage_array[cumulative_milage_array.length -1])
          }
        }
      }

      if (milage_present === false) {
        daily_milage_array.push(0);
        last_cumulative_miles = cumulative_milage_array[cumulative_milage_array.length -1]
        cumulative_milage_array.push(last_cumulative_miles);
      }
    }
    cumulative_milage_array.shift();

    function formatDate(date) {
      return String(date.getMonth() + 1) + "/" + String(date.getDate()) + "/" + String(date.getFullYear());
    }

    var formatted_dates = date_array.map(formatDate);
    var number_of_steps = parseInt(formatted_dates.length / 10) + 1;

    $('#chart-area').highcharts({
        chart: { type: 'column' },
        title: { text: 'Divvygraph' },
        xAxis: {
          categories: formatted_dates,
          labels: { maxStaggerLines: 1, rotation: 315, step: number_of_steps }
         },
        yAxis:
          [{
            title: { text: 'Miles This Day', style: { color: '#3DB7E4' } },
            labels: { style: { color: '#3DB7E4' } }
          },
          {
            title: { text: 'Total Miles Divvied', style: { color: '#FF7518' } },
            labels: { style: { color: '#FF7518' } },
            opposite: true,
            min: 0,
          }],
          plotOptions: {
            spline: {
              marker: {
                enabled: false
              }
            }
          },
        series: [
          { type: 'column', name: 'Miles This Day', data: daily_milage_array, color: '#3DB7E4'},
          { type: 'spline', name: 'Total Miles This Month', data: cumulative_milage_array, color: '#FF7518', yAxis: 1 }
          ],
        credits: false
    });

    $('#chart-area-margin').html("<br/><br/><br/>");

  }

  $('#calculate-my-milage').click(function() {
    calculateMyMilage();
  });

  $('#download-csv').click(function() {
    downloadCSV();
  });

  $('#make-chart').click(function() {
    makeChart();
  });

  $('#brag-toggle').click(function() {
    // Let's check if we have a milage value calculated before we let the user go bragging about it
    if (window.milage_calculated !== true) {
      $('#brag-area').html("Please calculate your milage first. <br/> Then we can brag about it!");
      return
    } else {
      var twitter_img = chrome.extension.getURL("twitter_logo_white.png");
      var star_img = chrome.extension.getURL("star_icon_white.png");
      var tweet_it_html = "<a class='bragging-type-option' target='_blank' href='";
      tweet_it_html += "https://twitter.com/share?text=My " + window.this_month + " bikeshare stats:%20" + window.number_of_trips + "%20trips.%20" + window.total_hours + "%20hours,%20" + window.remainder_minutes + "%20minutes,%20" + window.remainder_seconds + "%20seconds.%20" + window.total_milage + "%20miles.%20via&url=http://divvybrags.com&hashtags=DivvyBrags,bikeCHI,DivvyOn";
      tweet_it_html += "'><img src='" + twitter_img + "' width='48px' height='48px'/><br/>";
      tweet_it_html += "Tweet It</a>";
      var brag_html = "<a id='post-to-leaderboard' class='bragging-type-option'>";
      brag_html += "<img src='" + star_img + "' width='48px' height='48px'/><br/>";
      brag_html += "<span id='post-to-leaderboard-title'>Post To Leaderboard</span></a><span id='username-area'></span><br/><br/><br/>";
      brag_html += tweet_it_html
      if (window.posted_to_leaderboard === false) {
        $('#brag-area').html(brag_html);
      } else {
        $('#brag-area').html(tweet_it_html);
      }
    }
  });

  $('#post-to-leaderboard').livequery(function() {
    if (window.username === null || window.username == undefined) {
      $(this).click(function() {
        var total_milage = window.total_milage;
        enter_leaderboard_name_html = "Enter your name as you'd like it to appear on the Leaderboard: <br/><input id='username-input' type='text' style='width: 140px'/>";
        enter_leaderboard_name_html += "<br/><a id='post-it' class='divvybrags-option'><i>Post to Leaderboard</i></a>";
        $('#username-area').html(enter_leaderboard_name_html);
        $('#post-to-leaderboard').html("");
      });
    } else {
      $(this).click(function() {
        postIt();
      });
    }
  });

  $('#post-it').livequery(function() {
    $(this).click(function() {
      postIt();
    });
  });

  function checkName(user_name){
    var leaderboard_array = $('div#divvybrags p#leaderboard').children();
    var this_month_and_year = this_month + " " + this_year;
    var month_leaderboard_text = []; ;
    var yes_read = false;
    var br_flag = false;
    //Collect leaderboard for this month
    for (i = 0; i<leaderboard_array.length ; i++ ){
      if (leaderboard_array[i].innerText == this_month_and_year.toUpperCase()) {
        yes_read = true;
      }
      if (yes_read){
        if (leaderboard_array[i].localName == 'h10'){
					var aName = (leaderboard_array[i].innerText).split(':')[0];
					aName = aName.split('.')[1];
          month_leaderboard_text.push(aName.trim());
          br_flag = false;
        }
        else if (leaderboard_array[i].localName == 'br' && br_flag){
          break;
        }
        else if (leaderboard_array[i].localName == 'br'){
          br_flag = true;
        }
      }
    }
		if (month_leaderboard_text.indexOf(user_name)!= -1){
			if (confirm('This username has already been added to the leaderboard this month. \n If you want to change this username, click "OK". \n If this is your username and you want to update your mileage, click "Cancel"')) {
				var new_name = prompt("Please enter a new username", "");
				$('#username-input').val(new_name);
				return checkName(new_name);
			} else {
				return true;
			}
		}
     else {
			return false;
		}
  }

	function getUserName(){
		if (window.username === null || window.username == undefined) {
			var user_name = $('#username-input').val();
		} else {
			var user_name = window.username;
		}
		return user_name
	}

  function postIt() {
    var total_milage = window.total_milage;
    var update_flag = checkName(getUserName());
		var user_name = getUserName();
    $.ajax({
      type: "POST",
      url: "http://divvybrags-leaderboard.herokuapp.com/new_entry",
      data: { leaderboard_post: { flag: update_flag, name: user_name, miles: total_milage, city: "Chicago", month: window.this_month, year: window.this_year  } },
      success: function(data) {
        leaderboard_html = "";
        var leaderboard = data;
        for (var i = 0; i <=leaderboard.length -1; i++){
          var month = leaderboard[i];
          var month_name = Object.keys(month);
          leaderboard_html += "<h5 style ='font-style: italic;'>" + month_name + "</h5><br/>";
          for (var k = 0; k<month[month_name].length; k++){
            var leaderboard_entry = month[month_name][k];
            var rank = Object.keys(leaderboard_entry);
            var name = leaderboard_entry[rank]["name"];
            var miles = leaderboard_entry[rank]["miles"];
            leaderboard_html += "<h10>" + rank + ". " + name + ": " + miles + "mi</h10><br/>";
          }
          leaderboard_html += "<br/>"
        }
        $('#leaderboard').html(leaderboard_html);
        $('#username-area').html("");
        window.posted_to_leaderboard = true;
      }
    });
  }


  // Show/hide the sidebar
  $('#toggle-divvybrags').click(function() {
    if (window.showing_sidebar === true) {
      $('#divvybrags').animate({ height: "35px", width: "35px" });
      $(this).html("&#8601;");
      window.showing_sidebar = false;
    } else {
      $('#divvybrags').animate({ height: "100%", width: "240px" });
      $(this).html("X");
      window.showing_sidebar = true;
    }
  });

	function downloadCSV() {
		var csvContent = "data:text/csv;charset=utf-8,";
		csvContent += "Trip ID,Start Station,Start Date,End Station,End Date,Duration,Approximate Mileage\n"
		window.my_divvy_data.forEach(function(trip) {
			csvContent += (trip["trip_id"] + "," + trip["start_station"] + "," + trip["start_date"] + "," + trip["end_station"] + "," + trip["end_date"] + "," + trip["duration"] + "," + trip["milage"] +"\n" );
		});
		var encodedUri = encodeURI(csvContent);
		window.open(encodedUri);
	};

});

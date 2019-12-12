let mediaLessons = undefined;
const shouldDownload = true;
let downloadHD = false;
let downloadables = [];
let filtered = [];
let echo360Domain = '';

const GA_ACCOUNT_CODE = 'VUEtMTIxMzY2NDY1LTE='

// Google Analytics setup
var _gaq = _gaq || [];
_gaq.push(['_setAccount', atob(GA_ACCOUNT_CODE)]);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
const echo360BaseURIs = [
  'echo360.org.au',
  'echo360.org.uk',
  'echo360.org'
]

function canDownload({lesson}) {
  let downloadable = (lesson.isFuture === false && lesson.hasAvailableVideo === true && lesson.video != null && lesson.video.media && lesson.video.media.media) ? true : false;
  return downloadable;
}

function getVideoFileName({lesson}) {
  // ES6 allows you to do this.
  // Old: const updatedAt = lesson.lesson.updatedAt;
  // Old: const age, name = person.age, person.name
  // New: const {age, name} = person;
  const {updatedAt} = lesson.video.media;
  const quality = (downloadHD) ? "_HD" : "_SD";
  return updatedAt.slice(0, updatedAt.indexOf("T")) + quality + ".mp4";
}

// Returns only unit code.
function getUnitCode({lesson}) {
  const lectureName = lesson.lesson.name;
  var unitCodeTrailing = lectureName.slice(0, lectureName.indexOf("/"));
  try {
      // So UNSW uses ' ' instead of '_'.
      // This is a hack(kinda) to get it working for UNSW but should think of a better way to do it after some sleep.
    if(unitCodeTrailing.includes(" ")) {
      // Assume can split by space.
      return unitCodeTrailing.split(" ")[0];
    }
    // Monash uses underscores.
    return unitCodeTrailing.split("_")[0];
  } catch (err) {
    // Some Universities may have weird formats.
    return unitCodeTrailing;
  }
}

function getDownloadLink({lesson}) {
  // Expected case: lesson.video.media.media.current gives array of downloadable links.
  // Unexpected case: no attribute current (see unkown issues).
  // TODO: Handle this.
      chrome.tabs.query({currentWindow: true, active: true}, function(tabs){

        var currentTab = tabs[0].url;
        var domain = currentTab.match(/^[\w-]+:\/{2,}\[?([\w\.:-]+)\]?(?::[0-9]*)?/)[1];
        _gaq.push(['_trackEvent', domain, 'visited']);

        const {primaryFiles} = lesson.video.media.media.current;
        if (downloadHD) {
          const {s3Url, width, height} = primaryFiles[1];
          // TODO: URL for access outside of Australia.
          return `https://${domain}/media/download?s3Url=` + s3Url + "&fileName=hd1.mp4&resolution=" + width.toString() + "x" + height.toString();
        } else {
          const {s3Url, width, height} = primaryFiles[0];
          return `https://${domain}/media/download?s3Url=` + s3Url + "&fileName=sd1.mp4&resolution=" + width.toString() + "x" + height.toString();
        }
      });
}

// Job of this function is to listen init mediaLessons once per click.
function webRequestOnComplete(xhrRequest) {
  console.log("Media Lessons obtained!");
  _gaq.push(['_trackEvent', 'webReqFunc', 'loaded']);
  if (mediaLessons === undefined) {
    mediaLessons = xhrRequest;
    // Now perform the request again ourselves and download files.
    var getMediaLessonsRequest = new Request(mediaLessons.url, {method: 'GET'});
    fetch(
      getMediaLessonsRequest,
      {
        method: 'GET',
            credentials: 'include'
      })
      .then((getMediaLessonsResponse) => getMediaLessonsResponse.json())
      .then((getMediaLessonsJson) => {
        console.log(getMediaLessonsJson);
        downloadables = getMediaLessonsJson.data.filter((dataItem) => {
          return canDownload(dataItem);
        });

        // sort downloadables
        downloadables.sort((a, b) => {
          const nameA = getVideoFileName(a), nameB = getVideoFileName(b);
          if (nameA < nameB) return -1;
          else if (nameA == nameB) return 0;
          else return 1;
        });
        const lectureTable = document.getElementById("lectures");
        const lectureSelect = document.getElementById("lectureSelect");
        downloadables.forEach((downloadable) => {
          const option = document.createElement("option");
          option.defaultSelected = true;
          const name = getUnitCode(downloadable) + "_" + getVideoFileName(downloadable);

          option.innerHTML = name;
          lectureSelect.appendChild(option);
        });

        var downloadButton = document.getElementById('download');
          downloadButton.disabled = false;
        });
  }
}

function pageSetup(){
    document.getElementById("versionLabel").innerText = chrome.runtime.getManifest().version;
    chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
        var currentTab = tabs[0].url;
        console.log(currentTab);
        var domain = currentTab.match(/^[\w-]+:\/{2,}\[?([\w\.:-]+)\]?(?::[0-9]*)?/)[1];
        if(echo360BaseURIs.indexOf(domain) === -1){
            document.getElementById("load").setAttribute("disabled",true);
            document.getElementById("downloadHD").setAttribute("disabled", true);
            document.getElementById("mainBlock").setAttribute("hidden", true);
            document.getElementById("invalidMsg").removeAttribute("hidden")
        } else {
            echo360Domain = domain;
        }
    });
    // Use default value color = 'red' and likesColor = true.
    chrome.storage.sync.get({
        enableHD: false,
    }, function(items) {
        document.getElementById('downloadHD').checked = items.enableHD;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Add load button onclick. To refresh page to populate
    var loadButton = document.getElementById('load');
    let echo360Domain;
    pageSetup()
   
    loadButton.addEventListener('click', function () {

      chrome.tabs.query({currentWindow: true, active: true}, function(tabs){

        var currentTab = tabs[0].url;
        var domain = currentTab.match(/^[\w-]+:\/{2,}\[?([\w\.:-]+)\]?(?::[0-9]*)?/)[1];

        downloadHD = (document.getElementById("downloadHD").checked) ? true : false;
        console.log("echo360loaded", echo360Domain)
        chrome.webRequest.onCompleted.addListener(webRequestOnComplete, {urls: [`*://${domain}/*/syllabus`]});

        chrome.tabs.getSelected(null, function (tab) {
          var code = 'window.location.reload();';
          chrome.tabs.executeScript(tab.id, {code: code});
        });
    });
        
    }, false);

    document.getElementById("optionsBtn").addEventListener('click', function(){
        chrome.runtime.openOptionsPage();
    });
    // Add download button onclick.
    var downloadButton = document.getElementById('download');
    downloadButton.disabled = true;
    downloadButton.addEventListener('click', function () {
      downloadHD = (document.getElementById("downloadHD").checked) ? true : false;

      const lectureSelect = document.getElementById("lectureSelect");
      const options = lectureSelect.options;

      let selected = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected)
          selected.push(i);
      }

      // Using index as unique ID, since dates are not unique.
      let toDownload = [];
      for (let i = 0; i < downloadables.length; i++) {
        if (selected.indexOf(i) != -1)
          toDownload.push(downloadables[i]);
      }

      const port = chrome.runtime.connect();
      port.postMessage(toDownload, downloadHD);
      downloadButton.disabled = true;
      $("#lectureSelect").empty();
      mediaLessons = undefined;

      return;
    }, false);

}, false);

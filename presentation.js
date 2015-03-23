/**
 * libslides
 * Fun slides!
 * 
 * globals: presentation
 * 
 * @author Philipp Miller
 */

(function(factory, $, win, doc) {
  
  "use strict";
  
  // clean up custom html
  $('script[src*="jquery"]').remove();
  var scriptPath = $('script[src$="presentation.js"]').remove()[0].src.slice(0, -15)
    , slidesHtml = doc.documentElement.innerHTML;
  
  console.log("initializing presentation. assets path: '%s'", scriptPath);
  
  // request presentation.html
  $.ajax({
      mimeType: 'text/plain; charset=UTF-8',
      url:      scriptPath + "presentation.html",
      type:     'GET',
      dataType: 'text',
      cache:    false,
    })
    .done(function(scaffold) {
      
      // replace DOM
      doc.documentElement.innerHTML = scaffold;
      $(doc.head).append('<link href="' + scriptPath + 'presentation.css" rel="stylesheet">')
      
      // init presentation and inject custom html
      factory($, win, doc)
          .load(slidesHtml)
          .then(function() {
            console.log("presentation initialization complete");
          });
    });
    
  
  
})(function($, win, doc) {
  
  "use strict";
  
  var slideNavTemplate = '<nav class="slide-nav">'
        // + '<a class="first" title="Navigation"><i class="fa fa-fw fa-home"></i></a>'
        + '<a class="prev"  title="Navigation"><i class="fa fa-fw fa-angle-up"></i></a>'
        + '<a class="next"  title="Navigation"><i class="fa fa-fw fa-angle-down"></i></a>'
        + '<a class="slide-fullscreen" title="Fullscreen Slide"><i class="fa fa-fw fa-arrows-alt"></i></a>'
        + '<a class="presentation-menu-toggle" title="Navigation"><i class="fa fa-lg fa-fw fa-bars"></i></a>'
        + '</nav>'
    
    , settings = {
        replaceSlideTag: true,
      }
    
    , history      = win.history
    , urlFile      = doc.location.href.match(/^.*\/([^#]+)/)[1]
    , urlHashRegex = /^[^#]*#/
    
    , requestFullscreen = 'mozRequestFullScreen'
    , exitFullscreen    = 'mozCancelFullScreen'
    , fullscreenElement = 'mozFullScreenElement'
    
    , snapper     = debounce(350, snap)
    
    , $container  = $("#slides")
    , $scrolltip  = $("#scrolltip")
    , $menu       = $('#presentation-menu')
    , $slides
    , total
    , currentPage = 0
    , totalHeight
    , slideHeight
    , slideMargin
    , snapping
    , loadPromise
    , postInitCalback
    ;
  
  /**
   * Export global interface
   */
  var pres = win.presentation = {
    $container: $container,
    $slides:    null,
    
    load: function(str) {
      if (str.search(/^\w+\.html?$/i) === -1) {
        loadPromise = win.Promise.resolve();
        postInitCalback = $.noop;
        loaded(str);
        return loadPromise;
      }
      return loadPromise = new win.Promise(function(success) {
        postInitCalback = success;
        $.ajax({
          mimeType: 'text/plain; charset=UTF-8',
          url:      str,
          type:     'GET',
          dataType: 'text',
          cache:    false,
          success:  loaded,
        });
      });
    },
    
    then: function(fn) {
      return loadPromise.then(fn);
    },
    
    show: snap,
    
    next: function() {
      if (!pres.openNextSpoiler()) {
        snap(currentPage + 1);
      }
      return pres;
    },
    prev: function() {
      if (!pres.closePreviousSpoiler()) {
        snap(currentPage - 1);
      }
      return pres;
    },
    first: function() {
      snap(0);
      return pres;
    },
    last: function() {
      snap(total - 1);
      return pres;
    },
    
    /* Opens the first .collapsed spoiler in the current .slide */
    openNextSpoiler: function() {
      var $closedSpoilers = $(".spoiler.collapsed", $slides[currentPage]);
      if ($closedSpoilers.length) {
        $closedSpoilers.first().removeClass("collapsed");
        return true;
      }
      return false;
    },
    
    /* Closes the first :not(.collapsed) spoiler in the current .slide */
    closePreviousSpoiler: function() {
      var $openSpoilers = $(".spoiler:not(.collapsed)", $slides[currentPage]);
      if ($openSpoilers.length) {
        $openSpoilers.first().addClass("collapsed");
        return true;
      }
      return false;
    },
    
    enableSnapping: function() {
      if (!snapping) {
        $container.on("scroll", snapper);
        snapping = true;
      }
      return pres;
    },
    disableSnapping: function() {
      if (snapping) {
        $container.off("scroll", snapper);
        snapping = false;
      }
      return pres;
    },
    toggleSnapping: function() {
      return snapping ? pres.disableSnapping() : pres.enableSnapping();
    },
  };
  
  
  /**
   * Global init
   */
  function init() {
    $(win)
        .on('resize',  handleResize)
        .on('resize',  snapper)
        .on('keydown', keyNav)
        ;
    
    $(doc.documentElement)
        .on('click', '.presentation-menu-toggle', function(evt) {
          evt.preventDefault();
          $menu.toggleClass('visible');
        })
        .on('click', function(evt) {
          if (!$(evt.target).closest('.presentation-menu-toggle').length) {
            $menu.removeClass('visible');
          }
        })
        ;
    
    $container
        .on('scroll', handleScroll)
        .on('click', '.slide-fullscreen', function() {
          if (doc[fullscreenElement]) {
            doc[exitFullscreen]();
          }
          else {
            $(this).closest('.slide')[0][requestFullscreen]();
          }
        })
        .on('click', '.first', pres.first)
        .on('click', '.prev',  pres.prev)
        .on('click', '.next',  pres.next)
        .on('click', '.last',  pres.last)
        ;
  }
  
  /**
   * Init after #slides content was loaded
   */
  function loaded(htmlString) {
    
    if (settings.replaceSlideTag) {
      htmlString = htmlString
        .replace(/<slide(?:(?:([^>]*?)\sclass=["']([^"']*)["']([^>]*?))|([^>]*))>/gim,
                 '<div$1 class="slide $2"$3$4>')
        .replace(/<\/slide>/ig, '</div>')
        ;
    }
    
    $container.html($(htmlString));
    
    $slides = pres.$slides = $(".slide", $container);
    
    total = $slides.length;
    
    if (total <= 1) {
      return;
    }
    
    $slides.each(function(id, elem) {
      $(elem).data("page", id);
      this.insertAdjacentHTML("afterbegin",
          '<a class="page-anchor" id="page-' + id + '"></div>'
        + slideNavTemplate
      );
    });
    
    buildToc();
    buildSpoilers();
    buildTitle();
    
    handleResize();
    
    postInitCalback();
  }
  
  /**
   * Creates recursive hierarchy of nested headings in the slideshow,
   * then builds navigation DOM and inserts it in every <ol.toc>;
   * Class .noindex prevents headings from being added.
   */
  function buildToc() {
    var headings = $('h1:not(.noindex), h2:not(.noindex)', $container)
      , toc = []
      , h1, h2
      ;
    headings.each(function(i, elem) {
      var $elem = $(elem)
        , heading = {
          $elem:       $elem,
          title:       elem.innerHTML,
          id:          elem.id || (elem.id = $elem.generateId()),
          page:        +$elem.getPageNum(),
          subHeadings: [],
        };
      
      if (elem.tagName === "H1") {
        h1 = heading;
        toc.push(h1);
      } else {
        h1.subHeadings.push(heading);
      }
      
    });
    
    var tocHtml = (function buildTocSection(hs) {
      var html = "";
      for (var i = 0, len = hs.length ; i < len ; ++i) {
        html +=
              '<li><a href="#' + hs[i].id + '">'
            + hs[i].title + '</a>'
            + (hs[i].subHeadings.length
              ? '<ol>' + buildTocSection(hs[i].subHeadings) + '</ol>'
              : ''
              )
            + '</li>';
      }
      return html;
    })(toc);
    
    $('.toc')
        .html(tocHtml)
        .on("click", "a", snap);
  }
  
  /**
   * Adds toggle buttons to .spoiler elements
   */
  function buildSpoilers() {
    $(".spoiler", $container)
      .addClass("collapsed")
      .each(function() {
        var $spoiler = $(this);
        $('<a class="spoiler-toggle fa fa-fw">')
          .prependTo($spoiler)
          .click(function() {
            $spoiler.toggleClass("collapsed");
          });
      });
  }
  
  /**
   * Determine title form #title element
   * and set title where appropriate
   */
  function buildTitle() {
    var title = $("title", $container).text() || $("#title", $container).text();
    if (title) {
      document.title = title;
      $('h1 a', $menu).text(title);
    }
  }
  
  /**
   * Resize listener
   */
  function assignLengths() {
    totalHeight = $container[0].scrollHeight;
    slideHeight = totalHeight / total;
    slideMargin = (slideHeight - $container.innerHeight()) / 2;
  }
  
  /**
   * Resize listener - also called once after load
   */
  var handleResize = debounce(200, function() {
    assignLengths();
    pres.show(doc.location.hash)
        .enableSnapping();
  });
  
  /**
   * Scroll listener - regular/fast
   */
  function handleScroll() {
    var scrollTop = $container[0].scrollTop;
    currentPage = Math.round(scrollTop / slideHeight);
    if (Number.isInteger(currentPage)) {
      history.replaceState(null, "", "#page-" + currentPage);
      $scrolltip
          .text(currentPage)
          .addClass("update")
          .css("top", ((scrollTop + slideHeight / 2) / totalHeight * 100) + "%");
      hideScrolltip();
    }
  }
  
  /**
   * Scrolls a slide into view and centers it on screen.
   * Parameter can be either a page (int), a CSS id (string),
   * a click event with this.href referencing an id,
   * or nothing, which case it snaps to the closest page.
   * @param x
   */
  function snap(x) {
    var page;
    if (Number.isInteger(+x)) {
      page = +x;
    }
    else if (x) {
      if (typeof x === "string") {
        page = $(x.replace(urlHashRegex, '#')).getPageNum();
      }
      else if (x.type === "click") {
        x.preventDefault();
        page = $(this.href.replace(urlHashRegex, '#')).getPageNum();
      }
    }
    
    if (!Number.isInteger(page) || page < 0 || page >= total) {
      page = currentPage;
    }
    
    $container.animate({
        scrollTop: Math.round(page * slideHeight + slideMargin),
      }, 300);
    
    return pres;
  }
  
  /**
   * Hide the $scrolltip by removing .update (added by handleScroll)
   */
  var hideScrolltip = debounce(1000, function() {
    $scrolltip.removeClass("update");
  });
  
  /**
   * Global keyboard navigation
   * @param evt
   */
  function keyNav(evt) {
    if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
      return;
    }
    if ($.isNumeric(evt.key)) {
      pres.show(+evt.key);
      
    }
    else {
      switch(evt.key) {
        case "j":
        case " ":
        case "ArrowDown":
        case "PageDown":
          pres.next();
          break;
  
        case "k":
        case "Backspace":
        case "ArrowUp":
        case "PageUp":
          pres.prev();
          break;
  
        case "Home":
          pres.first();
          break;
          
        case "End":
          pres.last();
          break;
        
        case "+":
          pres.openNextSpoiler();
          break;
        
        case "-":
          pres.closePreviousSpoiler();
          break;
        
        default:
          return;
      }
    }
    evt.preventDefault();
  }
  
  /**
   * Executes a function only at the end of a series of calls,
   * with delay specifying how much time may pass between calls,
   * before the initial function is to be called.
   * @param delay
   * @param fn
   * @param thisArg
   * @returns {Function}
   */
  function debounce(delay, fn, thisArg) {
    var timeoutId;
    return function() {
      var args = arguments;
      thisArg = thisArg || this;
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function() {
        fn.apply(thisArg, args);
      }, delay);
    };
  }
  
  
  var tagRegex = /(<([^>]+)>)/g
    , umlauteRegex = /[äöüß]/g
    , umlauteMap = {
        'ä': "ae",
        'ö': "oe",
        'ü': "ue",
        'ß': "ss",
      }
  
  /**
   * Returns a possible id based on content; returns id if one exists
   * @return {string}
   */
  $.fn.generateId = function(maxLength) {
    if (this[0].id) {
      return this[0].id;
    }
    var id = this[0].innerHTML
        ? this[0].innerHTML
          .replace(tagRegex, "")
          .toLocaleLowerCase()
          .replace(umlauteRegex, function(c) { return umlauteMap[c]; })
          .replace(/\W+/g,'-')
          .slice(0, maxLength || 50)
          .replace(/^-+|-+$/g, "")
        : "uuid"
        ;
    if ($("#" + id).length) {
      var i = 2, idx = id + "-" + i;
      while ($("#" + idx).length) idx = id + "-" + i++;
      return idx;
    }
    return id;
  }
  
  /**
   * Mini jQuery plugin: Returns the page number of the slide
   * which an $element is a child of 
   * @returns {number}
   */
  $.fn.getPageNum = function() {
    return +this.closest(".slide").data("page");
  }
  
  // GO
  init();
  
  return pres;
  
}, jQuery, window, document);

$.noConflict();

function getSidebarCookie() {
	var match = document.cookie.match(/(^|;)\s*sidebarCollapsed=([^;]+)/);
	return match ? match[2] : null;
}

function setSidebarCookie(collapsed) {
	var expires = new Date();
	expires.setFullYear(expires.getFullYear() + 1);
	document.cookie = 'sidebarCollapsed=' + (collapsed ? '1' : '0') + '; path=/; expires=' + expires.toUTCString();
}

jQuery(document).ready(function($) {

	"use strict";

	// Remove no-transition lock after initial state is applied
	$('body').removeClass('sidebar-no-transition');

	[].slice.call( document.querySelectorAll( 'select.cs-select' ) ).forEach( function(el) {
		new SelectFx(el);
	});

	jQuery('.selectpicker').selectpicker;


	

	$('.search-trigger').on('click', function(event) {
		event.preventDefault();
		event.stopPropagation();
		$('.search-trigger').parent('.header-left').addClass('open');
	});

	$('.search-close').on('click', function(event) {
		event.preventDefault();
		event.stopPropagation();
		$('.search-trigger').parent('.header-left').removeClass('open');
	});

	if ($.fn.matchHeight) {
		$('.equal-height').matchHeight({
			property: 'max-height'
		});
	}

	// var chartsheight = $('.flotRealtime2').height();
	// $('.traffic-chart').css('height', chartsheight-122);


	// Counter Number
	$('.count').each(function () {
		$(this).prop('Counter',0).animate({
			Counter: $(this).text()
		}, {
			duration: 3000,
			easing: 'swing',
			step: function (now) {
				$(this).text(Math.ceil(now));
			}
		});
	});


	 
	 
	// Menu Trigger
	$('#menuToggle').on('click', function(event) {
		var windowWidth = $(window).width();   		 
		if (windowWidth<1010) { 
			$('body').removeClass('open'); 
			if (windowWidth<760){ 
				$('#left-panel').slideToggle(); 
			} else {
				$('#left-panel').toggleClass('open-menu');  
			} 
		} else {
			$('body').toggleClass('open');
			$('#left-panel').removeClass('open-menu');
			setSidebarCookie($('body').hasClass('open'));
		}
			 
	}); 

	 
	$(".menu-item-has-children.dropdown").each(function() {
		$(this).on('click', function() {
			var $sub = $(this).children('.sub-menu');
			if ($sub.find('li.subtitle').length === 0) {
				var $temp_text = $(this).children('.dropdown-toggle').html();
				$sub.prepend('<li class="subtitle">' + $temp_text + '</li>');
			}
		});
	});


	// Fixed tooltip for dropdown menu items in collapsed sidebar
	$('<div id="sidebar-fixed-tooltip"></div>').appendTo('body');

	$(document).on('mouseenter', 'body.open #left-panel .menu-item-has-children > a[data-tooltip]', function() {
		if ($(this).closest('li').hasClass('show')) return;
		var label = $(this).attr('data-tooltip');
		var rect = this.getBoundingClientRect();
		$('#sidebar-fixed-tooltip')
			.text(label)
			.css({ top: rect.top + rect.height / 2, left: rect.right + 12 })
			.show();
	});

	$(document).on('mouseleave', 'body.open #left-panel .menu-item-has-children > a[data-tooltip]', function() {
		$('#sidebar-fixed-tooltip').hide();
	});

	$(document).on('show.bs.dropdown', 'body.open #left-panel .menu-item-has-children', function() {
		$('#sidebar-fixed-tooltip').hide();
	});

	// Reposition collapsed sidebar submenus to prevent viewport overflow
	$(document).on('show.bs.dropdown', '#left-panel .menu-item-has-children', function() {
		if (!$('body').hasClass('open')) return;
		var $submenu = $(this).find('.sub-menu.dropdown-menu');
		var $li = $(this);
		$submenu.css('top', '');

		setTimeout(function() {
			var liTop = $li.offset().top;
			var submenuHeight = $submenu.outerHeight();
			var viewportHeight = $(window).height();

			if (liTop + submenuHeight > viewportHeight - 10) {
				var adjusted = Math.max(10, viewportHeight - submenuHeight - 10);
				$submenu.css('top', (adjusted - liTop) + 'px');
			}
		}, 0);
	});

	// Load Resize
	$(window).on("load resize", function(event) {
		var windowWidth = $(window).width();  		 
		if (windowWidth<1010) {
			$('body').addClass('small-device'); 
		} else {
			$('body').removeClass('small-device');  
		} 
		
	});
  
 
});
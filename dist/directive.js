/*
 * Legal...
 */
var DirectiveContainer = (function() {

var DIRECTIVE_MARK_KEY = 'data-directive-id';

function forEach(collection, fn) {
  if (collection == null) return;

  if (collection.length != null) {
    for(var i=0;i<collection.length;i++) {
      fn(collection[i], i);
    }
  } else {
    for(var i in collection) {
      if (collection.hasOwnProperty(i)) {
        fn(collection[i], i);
      }
    }
  }
}

function isElementMarked(element) {
  var val = element.getAttribute(DIRECTIVE_MARK_KEY);
  return val != null && val >= 0;
}

function markElement(element, instanceID) {
  instanceID != null
      ? element.setAttribute(DIRECTIVE_MARK_KEY, instanceID)
      : element.removeAttribute(DIRECTIVE_MARK_KEY);
}

function camelCase(value) {
  return value.replace(/-./g, function(v) {
    return v.charAt(1).toUpperCase();
  });
}

function compileAttrs(element) {
  var attrs = {};
  forEach(element.attributes, function(entry) {
    var attr = entry.name;
    if (attr && attr.length) {
      var value = entry.value;
      if (value !== undefined) {
        attrs[camelCase(attr)] = value;
      }
    }
  });
  return attrs;
}

var DirectiveContainer = (function(container) {
  container = container || document.body;
  var nextInstanceID = 0;
  
  var lookup = {};
  var instances = {};
  var events = {};

  var watchers = [];
  function watchPulse(fn) {
    watchers.push(fn);
    return function deregister() {
      var index = watchers[fn];
      watchers.splice(index, 1); 
    };
  }

  function watchFlush() {
    forEach(watchers, function(watch) {
      watch();
    });
  }

  function directiveBodyTemplate(element) {
    var propertyCache = {};
    return {
      $events : {},
      $watchers : [],
    
      on : function(event, fn) {
        events[event] = events[event] || [];
        events[event].push(this);
        
        this.$events[event] = this.$events[event] || [];
        this.$events[event].push(fn);
      },

      observe : function(prop, fn) {
        var deregister = watchPulse(function() {
          var oldValue = propertyCache[prop];
          var newValue = element.getAttribute(prop);
          if (oldValue !== newValue) {
            propertyCache[prop] = newValue;
            fn(newValue, oldValue);
          }
        });

        this.$watchers.push(deregister);
      },

      destroy : function() {
        forEach(this.$watchers, function(fn) {
          fn();
        });
        triggerOnFn(this, 'destroy');
      }
    };
  }

  function triggerOnFn(instance, event, data) {
    var listeners = instance.$events[event] || [];
    forEach(listeners, function(fn) {
      fn(data);
    });
  }

  var self;
  return self = {
    register : function(selector, bodyFn) {
      lookup[selector] = lookup[selector] || [];
      lookup[selector].push(bodyFn);
    },

    list : function() {
      var result = [];
      forEach(lookup, function(fns, selector) {
        forEach(fns, function(bodyFn) {
          result.push([selector, bodyFn]);
        });
      });
      return result;
    },

    scan : function(innerContainer, filterFn) {
      var innerContainer = innerContainer || container;
      filterFn = filterFn || function(val) { return true; };
      var entries = [];
      forEach(lookup, function(fns, selector) {
        forEach(innerContainer.querySelectorAll(selector), function(element) {
          if (filterFn(element)) {
            forEach(fns, function(bodyFn) {
              entries.push([element, bodyFn]);
            });
          }
        });
      });
      return entries;
    },

    compile : function(innerContainer) {
      forEach(self.scan(innerContainer, rejectIfMarkedFn), function(entry) {
        var element = entry[0];
        var bodyFn = entry[1];
        var instance = directiveBodyTemplate(element);
        var instanceID = (nextInstanceID++) + '';
        bodyFn.call(instance, element, compileAttrs(element));
        instances[instanceID] = instance;
        markElement(element, instanceID);
      });
      
      self.checkObservers();

      function rejectIfMarkedFn(element) {
        return !isElementMarked(element);
      }
    },

    decompile : function(innerContainer) {
      forEach(self.scan(innerContainer, isElementMarked), function(entry) {
        var element = entry[0];
        var instanceID = element.getAttribute(DIRECTIVE_MARK_KEY);
        var instance = instances[instanceID];
        instance.destroy();
        delete instances[instanceID];
        markElement(element, undefined);
      });
    },

    update : function(newContent) {
      var replacementContainer = container;
      if (arguments.length == 2) {
        replacementContainer = container.querySelector(arguments[0]);
        newContent = arguments[1];
      }
      self.decompile(replacementContainer);
      self.trigger(container, 'update');

      if (typeof newContent == 'string') {
        replacementContainer.innerHTML = newContent;
      } else {
        replacementContainer.innerHTML = '';
        replacementContainer.appendChild(newContent);
      }
      self.compile(replacementContainer);
    },

    trigger : function(event, data) {
      forEach(events[event] || [], function(instance) {
        triggerOnFn(instance, event, data);
      });
    },

    attr : function(element, attr, value) {
      element.setAttribute(attr, value);
      self.checkObservers();
    },

    checkObservers : function() {
      watchFlush();
    }
  }
});

  return DirectiveContainer;
})();

if ( typeof module === "object" && typeof module.exports === "object" ) {
  module.exports = DirectiveContainer;
}

/***** BEGIN LICENSE BLOCK *****

NoScript - a Firefox extension for whitelist driven safe JavaScript execution
Copyright (C) 2004-2005 Giorgio Maone - g.maone@informaction.com

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

***** END LICENSE BLOCK *****/

function NoScriptOverlay() {
  this.ns=new NoScript();
}

NoScriptOverlay.prototype={
  _strings: null,
  get strings() {
    return this._strings?this._strings:this._strings=document.getElementById("noscript-strings");  
  }
,
  _stringsFB: null,
  get stringsFB() {
    return this._stringsFB?this._stringsFB:this._stringsFB=document.getElementById("noscript-stringsFB");  
  }
,
  _stringFrom: function(bundle,key,parms) {
    try {
      return parms?bundle.getFormattedString(key,parms):bundle.getString(key);
    } catch(ex) {
      return null;
    }
  }
,
  getString: function(key,parms) {
    var s=this._stringFrom(this.strings,key,parms);
    return s?s:this._stringFrom(this.stringsFB,key,parms);
  }
,
  getSites: function(doc,sites,tagName) {
    try {
      if(doc || (doc=this.srcDocument)) {
        const ns=this.ns;
        var url=ns.getSite(doc.URL);
       
        if(sites) {
          sites[sites.length]=url;
        } else {
          sites=[url];
          sites.scriptCount=0;
        }
        
        if(!tagName) {
          var scripts=new XPCNativeWrapper(doc.getElementsByTagName("script"),"item()","length");
          var scount=scripts.length;
          sites.scriptCount+=scount;
          var script;
          while(scount-->0) {
            script=new XPCNativeWrapper(scripts.item(scount),"src");
            if(script.src) {
              sites[sites.length]=ns.getSite(script.src);
            }
          }
          
          this.getSites(doc, sites, 'frame');
          this.getSites(doc, sites, 'iframe');
          return ns.sortedSiteSet(sites);

        } else {
          
          var frames=new XPCNativeWrapper(doc.getElementsByTagName(tagName),"item()","length");
          var frame;
          for(var j=frames.length; j-->0;) {
            try {
              frame=new XPCNativeWrapper(frames[j],"contentDocument")
              if(frame.contentDocument) this.getSites(frame.contentDocument,sites);
            } catch(ex2) {
            }
          }
        }
      }
     
    } catch(ex) {
      // dump(ex);
    }
    return sites?sites:{ length: 0, scriptCount: 0 };
  }
,
  get prompter() {
    return Components.classes["@mozilla.org/embedcomp/prompt-service;1"
          ].getService(Components.interfaces.nsIPromptService);
  }
,
  uninstallAlert: function() {
    this.prompter.alert(window,this.getString("uninstall.alert.title"),
          this.getString("uninstall.alert.text",
            [this.getString("allowed."+(this.ns.jsEnabled?"glb":"no") ) ]
            ));
  }
,
  prepareContextMenu: function(ev) {
    menu=document.getElementById("noscript-context-menu");
    if(this.ns.uninstalling || !this.ns.getPref("ctxMenu",true)) {
      menu.setAttribute("collapsed",true);
      return;
    }
    menu.removeAttribute("collapsed");
    const status=document.getElementById("noscript-status");
    menu.setAttribute("image",status.getAttribute("src"));
    menu.setAttribute("tooltiptext",status.getAttribute("tooltiptext"));
  }
,
  prepareMenu: function(popup) {
    const ns=this.ns;
    const global=ns.jsEnabled;
    var j,k,node;
    var separators=popup.getElementsByTagName("menuseparator");
    var insertSep,stopSep,globalSep;
    const sepNames=['insert','stop','global'];
    var sepName;
    for(j=separators.length; j-- >0;) {
      sepName=(node=separators[j]).className;
      for(k in sepNames) {
        if(sepName.indexOf("-"+sepNames[k])>-1) {
          eval(sepNames[k]+"Sep=node");
        }
      }
    }
    
    delete separators;
    const miGlobal=globalSep.nextSibling;
    miGlobal.setAttribute("label",this.getString((global?"forbid":"allow")+"Global"));
    miGlobal.setAttribute("oncommand","noscriptOverlay.menuAllow("+(!global)+")");
    miGlobal.setAttribute("tooltiptext",document.getElementById("noscript-status").getAttribute("tooltiptext"));
    miGlobal.setAttribute("image",this.getIcon(global?"no":"glb"));

    
    node=insertSep.nextSibling;
    const parent=node.parentNode;
    var remNode;
    while(node && (node!=stopSep)) {
       remNode=node;
       node=node.nextSibling;
       parent.removeChild(remNode);
    }
    
    const sites=this.getSites();
    var site,enabled,lev;
    const allowedSites=ns.sites;
    var matchingSite;
    var menuSites,menuSite,scount;
    var domain,pos;
    var domainDupChecker={
      prev: "",
      check: function(d) {
         d=" "+d+" ";
         if(this.prev.indexOf(d)>-1) return true;
         this.prev+=d;
         return false;
      }
    };
    
    for(j=sites.length; j-->0;) {
     
      site=sites[j];
      matchingSite=ns.findShortestMatchingSite(site,allowedSites);
      enabled=matchingSite!=null;
      if(enabled) {
        if(domainDupChecker.check(matchingSite)) continue;
        menuSites=[matchingSite];
      } else {
        domain=site.match(/.*:\/\/([\w\-\.]+)/);
        menuSites=[site];
        if(domain) {
          domain=domain[1];
          for(;(pos=domain.indexOf('.'))>0; domain=domain.substring(pos+1)) {
            if(!domainDupChecker.check(domain)) {
              menuSites[menuSites.length]=domain;
            }
          }
        }
      }
      
      node=document.createElement("menuseparator");
      parent.insertBefore(node,stopSep);
      
      for(scount=menuSites.length; scount-->0;) {
        menuSite=menuSites[scount];
        node=document.createElement("menuitem");
        node.setAttribute("label",this.getString((enabled?"forbidLocal":"allowLocal"),[menuSite]));
        node.setAttribute("statustext",menuSite);
        node.setAttribute("oncommand","noscriptOverlay.menuAllow("+(!enabled)+",this)");
        node.setAttribute("tooltiptext",
          this.getString("allowed."+(enabled?"yes":"no")));
        if(enabled && ns.isPermanent(menuSite)) {
          node.setAttribute("class","");
          node.setAttribute("disabled","true");
        } else {
          node.setAttribute("class","menuitem-iconic");
          node.setAttribute("image",this.getIcon(enabled?"no":"yes"));
        }
        parent.insertBefore(node,stopSep);
      }
    }
    
    if(insertSep==parent.firstChild) {
      // kill exceeding top separator in contextual menu 
      insertSep.nextSibling.setAttribute("collapsed","true");
    }
      
  }
,
  get srcWindow() {
    //var w=document.commandDispatcher.focusedWindow;
    return new XPCNativeWrapper(window._content, 'document','getSelection()');
  }
,
  get srcDocument() {
    return new XPCNativeWrapper(this.srcWindow.document, 'getElementsByTagName()','URL');
  }
,
  menuAllow: function(enabled,menuItem) {
    const ns=this.ns;
    var reload=ns.getPref("autoReload",true);
    if(menuItem) { // local 
      const site=menuItem.getAttribute("statustext");
      if(site) {
        ns.setJSEnabled(site,enabled);
      }
    } else { // global
      if(enabled) {
        enabled=this.prompter.confirm(window,this.getString("global.warning.title"),
          this.getString("global.warning.text"));
        reload=enabled;
      }
      ns.jsEnabled=enabled;
    }
    ns.savePrefs();
    if(reload) BrowserReload();
    this.syncUI();
  }
,
  _iconURL: null,
  getIcon: function(lev,inactive) {
    if(!this._iconURL) this._iconURL=document.getElementById("noscript-status").src;
    return this._iconURL.replace(/[^\/]*(yes|no|glb|prt)(\d+\.)/,(inactive?"inactive-":"")+lev+"$2");
  }
,
  _syncInfo: { enqueued: false, uninstallCheck: false }
,
  syncUI: function(ev) {
    if(ev && ev.eventPhase==ev.AT_TARGET && ev.target==document && ev.type=="focus") {
      this._syncInfo.uninstallCheck=true;
    }
    
    if(!this._syncInfo.enqueued) {
      this._syncInfo.enqueued=true;
      window.setTimeout(function(nso) { 
        try {
          nso._syncUINow();
        } catch(ex) {
          // dump(ex);
        }
        nso._syncInfo.enqueued=false; 
       }, 400, this);
    }
  }
,
  _syncUINow: function() {
    // dump("syncUINow called\n");
    const ns=this.ns;
    
    if((!this.cleanupDone) && this._syncInfo.uninstallCheck && this.cleanup()) {
      window.setTimeout(function() { noscriptOverlay.uninstallAlert(); }, 10);
    }
    this._syncInfo.uninstallCheck=false;
    
    if(ns.uninstalling) {
      const popup=document.getElementById("noscript-status-popup");
      if(popup) {
        popup.parentNode.setAttribute("onclick","noscriptOverlay.uninstallAlert()");
        popup.parentNode.removeChild(popup);
      }
    }
    
    const global=ns.jsEnabled;
    var lev;
    const sites=this.getSites();

    if(global) {
      lev="glb";
    } else {
      var allowed=0;
      var scount=sites.length;
      var total=scount;
      var site;
      while(scount-->0) {
        site=ns.findShortestMatchingSite(sites[scount]);
        if(site) { 
          if(ns.isPermanent(site)) {
            total--;
          } else {
            allowed++;
          }
        } 
      }
      //lev=allowed==0?"no":allowed==total?"yes":"prt";   
      lev=(allowed==total && sites.length>0)?"yes":allowed==0?"no":"prt"; 
    }
    const widget=document.getElementById("noscript-status");
    widget.setAttribute("tooltiptext",
      this.getString("allowed."+lev)+" ("+sites.scriptCount+")");
    widget.setAttribute("src",this.getIcon(lev,!sites.scriptCount));
  }
,
  chromeBase: "chrome://noscript/content/",
  chromeName: "noscript"
,
  openOptionsDialog: function() {
    window.openDialog(this.chromeBase+this.chromeName+"Options.xul",this.chromeName+"Options",
      "chrome,dialog,centerscreen,alwaysRaised");
  }
,
  openAboutDialog: function() {
    window.openDialog(this.chromeBase+"about.xul",this.chromeName+"About",
      "chrome,dialog,centerscreen");
  }
,
  cleanupDone: false
,
  cleanup: function() {
    // dump("Cleanup check called\n");
    return this.cleanupDone=this.ns.cleanupIfUninstalling();
  }
  
}

noscriptOverlay=new NoScriptOverlay();

_noScript_syncUI=function(ev) { 
  noscriptOverlay.syncUI(ev); 
};
_noScript_prepareCtxMenu=function(ev) {
    noscriptOverlay.prepareContextMenu(ev);
};
_noScript_onloadInstall=function(ev) {
  document.getElementById("contentAreaContextMenu").addEventListener(
    "popupshowing",_noScript_prepareCtxMenu,false);
};

_noScript_syncEvents=["load","focus"];
_noScript_syncEvents.visit=function(callback) {
  for(var e=0,len=this.length; e<len; e++) {
    callback.call(window,this[e],_noScript_syncUI,true);
  }
}
_noScript_install=function() {
  _noScript_syncEvents.visit(window.addEventListener);
  window.addEventListener("load",_noScript_onloadInstall,false);
  window.addEventListener("unload",_noScript_dispose,false);
};

_noScript_dispose=function(ev) {
  noscriptOverlay.cleanup();
  _noScript_syncEvents.visit(window.removeEventListener);
  window.removeEventListener("load",_noScript_onloadInstall,false);
  document.removeEventListener("popupshowing",_noScript_prepareCtxMenu,false);
};

_noScript_install();


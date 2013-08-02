var Sketch = (function(){
  var canvas, context;
  var tool;
  var default_tool = 'circle';
  var strokeColor = '#000';
  var fillColor = '#FFF';
  var polygons = [];
  var changed = false;

  var API = {}; //Holds all public functions
  
  var line = function(){
    var that = {}
    that.strokeStyle = "#000";
    that.lineWidth = 2;
    
    that.lineDraw = function(context, selected){
      context.lineWidth = that.lineWidth;
      context.strokeStyle = (selected === true) ? "#FF0" : that.strokeStyle;
      context.stroke();
    };

    that.lineToJson = function(){
      return '"ss":"'+that.strokeStyle+'","lw":'+that.lineWidth;
    };

    that.lineFromJson = function(jsonObj){
      that.strokeStyle = jsonObj.ss;
      that.lineWidth = jsonObj.lw;
    };

    return that;
  };

  var polygon = function(){
    var that = line();
    that.fillStyle = "#ffffff";

    that.polygonDraw = function(context, selected){
      context.fillStyle = that.fillStyle;
      context.fill();
      that.lineDraw(context, selected);
      context.closePath();
    };

    that.polygonToJson = function(){
      return that.lineToJson() + ',"fs":"'+that.fillStyle+'"';
    };

    that.polygonFromJson = function(jsonObj){
      that.lineFromJson(jsonObj);
      that.fillStyle = jsonObj.fs;
    }

    return that;
  }

  var circle = function(cell){
    var that = polygon();
    that.from = cell;

    that.draw = function(context, selected){
      var cx,cy,d;
      cx = ((that.from.x+that.to.x)/2).toFixed(0);
      cy = ((that.from.y+that.to.y)/2).toFixed(0);
      r = Math.sqrt(Math.pow(that.to.x-that.from.x,2) + Math.pow(that.to.y-that.from.y,2))/2;
      context.beginPath();
      context.arc(cx, cy, r, 0, Math.PI*2, true);
      that.polygonDraw(context, selected);
      that.center = {x:cx,y:cy};
      that.radius = r;
    };

    that.isValid = function(){
      var modx = Math.abs(that.from.x - that.to.x),
          mody = Math.abs(that.from.y - that.to.y);
      if(!that.from || !that.to || modx + mody < 10 ){
        return false;
      }
      return true;
    };

    that.update = function(cell) {
      that.to = cell;
    };

    that.contains = function(cell){
      var d = Math.sqrt(Math.pow(that.center.x-cell.x,2) + Math.pow(that.center.y-cell.y,2));
      if (d > that.radius){
        return false;
      }
      return true;
    };

    that.move = function(incr){
      that.from.x += incr.x,
      that.from.y += incr.y;
      that.to.x += incr.x,
      that.to.y += incr.y;
    };

    that.toJson = function(){
      //Define type, center and radius
      return '{"t":"circle","s": ['+that.from.x+','+that.from.y+'],"e":['+that.to.x+','+that.to.y+'],'+that.polygonToJson()+'}';
    };

    that.fromJson = function(jsonObj){
      that.from = {x:jsonObj.s[0],y:jsonObj.s[1]};
      that.to = {x:jsonObj.e[0],y:jsonObj.e[1]};
      that.polygonFromJson(jsonObj);
    };

    return that;
  };

  var rectangle = function(cell){
    var that = polygon();;
    that.start = cell;
   
    that.draw = function(context, selected){
      context.beginPath();
      context.rect(that.x, that.y, that.w, that.h);
      that.polygonDraw(context, selected);
    }

    that.isValid = function(){
      if(!that.start || !that.w || !that.h){
        return false;
      }
      return true;
    };

    that.update = function(cell) {
      var x = Math.min(that.start.x,  cell.x),
          y = Math.min(that.start.y,  cell.y),
          w = Math.abs(that.start.x - cell.x),
          h = Math.abs(that.start.y - cell.y);
      that.x = x;
      that.y = y;
      that.w = w;
      that.h = h;
    };

    that.contains = function(cell){
      var lx = that.x,
          ly = that.y,
          ux = that.x + that.w,
          uy = that.y + that.h;
      if (cell.x > lx && cell.y > ly && cell.x < ux && cell.y < uy){
        return true;
      }
      return false;
    };

    that.move = function(incr){
      that.x = that.x + incr.x;
      that.y = that.y + incr.y;
    };

    that.toJson = function(){
      //Define type, upper left corner (ulc), width(w) and height(h)
      return '{"t":"rectangle","ulc":['+that.x+','+that.y+'],"w":'+that.w+',"h":'+that.h+','+that.polygonToJson()+'}';
    };

    that.fromJson = function(jsonObj){
      that.x = jsonObj.ulc[0];
      that.y = jsonObj.ulc[1];
      that.w = jsonObj.w;
      that.h = jsonObj.h;
      that.polygonFromJson(jsonObj);
    };

    return that;
  };

  var segment = function(cell){
    var that = line();
    that.from = cell;
   
    that.draw = function(context, selected){
      context.beginPath();
      context.moveTo(that.from.x, that.from.y);
      context.lineTo(that.to.x, that.to.y);
      that.lineDraw(context, selected);
    }

    that.isValid = function(){
      var modx = Math.abs(that.from.x - that.to.x),
          mody = Math.abs(that.from.y - that.to.y);
      if(!that.from || !that.to || modx + mody < 10 ){
        return false;
      }
      return true;
    }

    that.update = function(cell) {
      that.to = cell;
    };

    that.contains = function(cell){
      return that.isCellOverSegment(that.from, that.to, cell);
    };

    that.isCellOverSegment = function(from, to, cell){
      var x,y,hysteresis = 3,
          lx = Math.min(from.x,to.x) - hysteresis,
          ly = Math.min(from.y,to.y) - hysteresis,
          ux = Math.max(from.x,to.x) + hysteresis,
          uy = Math.max(from.y,to.y) + hysteresis;
          
      if (cell.x < lx || cell.y < ly || cell.x > ux || cell.y > uy){
        return false;
      }

      var e1 = (cell.y - from.y),
          e2 = (to.x - from.x),
          e3 = (cell.x - from.x),
          e4 = (to.y - from.y);
      e1 = (Math.abs(e1) < hysteresis) ? 0 : e1;
      e2 = (Math.abs(e2) < hysteresis) ? 0 : e2;
      e3 = (Math.abs(e3) < hysteresis) ? 0 : e3;
      e4 = (Math.abs(e4) < hysteresis) ? 0 : e4;
      if((e1===0 && e4===0) || (e2===0 && e3===0)){
        return true;
      }
      y = e1/e4,
      x = e3/e2;
      return (x.toFixed(0) === y.toFixed(0));
    }

    that.move = function(incr){
      var fx = that.from.x + incr.x,
          fy = that.from.y + incr.y,
          tx = that.to.x + incr.x,
          ty = that.to.y + incr.y;
      that.from = {x:fx, y:fy};
      that.to = {x:tx, y:ty};
    };

    that.toJson = function(){
      //Define type, start point(s), end point(e)
      return '{"t":"segment","s": ['+that.from.x+','+that.from.y+'],"e":['+that.to.x+','+that.to.y+'],'+that.lineToJson()+'}';
    };

    that.fromJson = function(jsonObj){
      that.from = {x:jsonObj.s[0],y:jsonObj.s[1]};
      that.to = {x:jsonObj.e[0],y:jsonObj.e[1]};
      that.lineFromJson(jsonObj);
    };

    return that;
  };

  var arrow = function(cell){
    var that = segment(cell);

    var arrowHead = function(){
      var d = 10;
      var x2 = that.to.x,
          x1 = that.from.x,
          y2 = that.to.y,
          y1 = that.from.y;
      var angle = Math.PI/8;
      // calculate the angle of the line
      var lineangle=Math.atan2(y2-y1,x2-x1);
      // h is the line length of a side of the arrow head
      var h=Math.abs(d/Math.cos(angle));
      var angle1=lineangle+Math.PI+angle;
      var topx=x2+Math.cos(angle1)*h;
      var topy=y2+Math.sin(angle1)*h;

      var angle2=lineangle+Math.PI-angle;
      var botx=x2+Math.cos(angle2)*h;
      var boty=y2+Math.sin(angle2)*h;
      return {topx:topx, topy:topy, boty:boty, botx:botx}
    };

    that.draw = function(context, selected){
      var ah = arrowHead();
      context.beginPath();
      context.moveTo(that.from.x, that.from.y);
      context.lineTo(that.to.x, that.to.y);
      context.moveTo(ah.botx, ah.boty);
      context.lineTo(that.to.x, that.to.y);
      context.moveTo(ah.topx, ah.topy);
      context.lineTo(that.to.x, that.to.y);
      that.lineDraw(context, selected);
    };

    that.toJson = function(){
      //Define type, start point(s), end point(e)
      return '{"t":"arrow","s":['+that.from.x+','+that.from.y+'],"e":['+that.to.x+','+that.to.y+'],'+that.lineToJson()+'}';
    };


    return that;
  };

  var curve = function(cell){
    var that = segment();
    that.from = cell;
   
    that.draw = function(context, selected){ 
      var control = that.getControlPoint();
      context.beginPath();
      context.moveTo(that.from.x, that.from.y);
      context.quadraticCurveTo(control.x, control.y, that.to.x, that.to.y);
      context.lineTo(that.to.x, that.to.y);
      that.lineDraw(context, selected);
      that.control = control;
    };

    that.getControlPoint = function(){
      var d = Math.sqrt(Math.pow(that.to.x-that.from.x,2) + Math.pow(that.to.y-that.from.y,2));
      var x2 = that.to.x,
          x1 = that.from.x,
          y2 = that.to.y,
          y1 = that.from.y;
      var angle = Math.PI/8;
      // calculate the angle of the line
      var lineangle=Math.atan2(y2-y1,x2-x1);
      // h is the line length of a side of the arrow head
      var h=Math.abs(d/Math.cos(angle));
      var angle1=lineangle+Math.PI+angle;
      var topx=x2+Math.cos(angle1)*h;
      var topy=y2+Math.sin(angle1)*h;
      return {x: topx, y:topy};
    };

    that.contains = function(cell){
      var mid1 = {x:Math.round((that.from.x+that.control.x)/2), y:Math.round((that.from.y+that.control.y)/2)},
          mid2 = {x:Math.round((that.control.x+that.to.x)/2), y:Math.round((that.control.y+that.to.y)/2)},
          seg1 = that.isCellOverSegment(that.from, mid1, cell),
          seg2 = that.isCellOverSegment(mid1, mid2, cell),
          seg3 = that.isCellOverSegment(mid2, that.to, cell);
      if(seg1 || seg2 || seg3){
        return true;
      }
      return false;
    };

    that.toJson = function(){
      //Define type, start point(s), end point(e)
      return '{"t":"curve","s": ['+that.from.x+','+that.from.y+'],"e":['+that.to.x+','+that.to.y+'],'+that.lineToJson()+'}';
    };

    return that;
  };

  var parable = function(cell){
    var that = curve(cell);

    that.getControlPoint = function(){
      var h = Math.sqrt(2)*(Math.sqrt(Math.pow(that.to.x-that.from.x,2) + Math.pow(that.to.y-that.from.y,2))/2),
          x2 = that.to.x,
          x1 = that.from.x,
          y2 = that.to.y,
          y1 = that.from.y;
      var angle = Math.PI/4;
      var lineangle=Math.atan2(y2-y1,x2-x1);
      var angle1=lineangle+Math.PI+angle;
      var topx=x2+Math.cos(angle1)*h;
      var topy=y2+Math.sin(angle1)*h;
      return {x: topx, y:topy};
    };

    that.toJson = function(){
      //Define type, start point(s), end point(e)
      return '{"t":"parable","s": ['+that.from.x+','+that.from.y+'],"e":['+that.to.x+','+that.to.y+'],'+that.lineToJson()+'}';
    };

    return that;
  };

  var arc = function(cell){
    var that = segment();
    that.from = cell;
   
    that.draw = function(context, selected){ 
      var control1 = that.getControlPoints(that.from, that.to)[0];
          control2 = that.getControlPoints(that.to, that.from)[1];
      context.beginPath();
      context.moveTo(that.from.x, that.from.y);
      context.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, that.to.x, that.to.y);
      context.lineTo(that.to.x, that.to.y);
      that.lineDraw(context, selected);
      that.control1 = control1;
      that.control2 = control2;
    };

    that.getControlPoints = function(a, b){
      var d = Math.sqrt(Math.pow(b.x-a.x,2) + Math.pow(b.y-a.y,2));
      var x2 = b.x,
          x1 = a.x,
          y2 = b.y,
          y1 = a.y;
      var angle = Math.PI/8;
      // calculate the angle of the line
      var lineangle=Math.atan2(y2-y1,x2-x1);
      // h is the line length of a side of the arrow head
      var h=Math.abs(d/Math.cos(angle));
      var angle1=lineangle+Math.PI+angle;
      var topx=x2+Math.cos(angle1)*h;
      var topy=y2+Math.sin(angle1)*h;
      var angle2=lineangle+Math.PI-angle;
      var botx=x2+Math.cos(angle2)*h;
      var boty=y2+Math.sin(angle2)*h;
      return [{x: topx, y:topy}, {x: botx, y:boty}];
    };

    that.contains = function(cell){
      //midpoints order is based on http://www.html5canvastutorials.com/tutorials/html5-canvas-bezier-curves/
      var mid1 = {x:Math.round((that.from.x+that.control1.x)/2), y:Math.round((that.from.y+that.control1.y)/2)},
          mid3 = {x:Math.round((that.control1.x+that.control2.x)/2), y:Math.round((that.control1.y+that.control2.y)/2)},
          mid5 = {x:Math.round((that.control2.x+that.to.x)/2), y:Math.round((that.control2.y+that.to.y)/2)},
          mid2 = {x:Math.round((mid1.x+mid3.x)/2), y:Math.round((mid1.y+mid3.y)/2)},
          mid4 = {x:Math.round((mid3.x+mid5.x)/2), y:Math.round((mid3.y+mid5.y)/2)},
          seg1 = that.isCellOverSegment(that.from, mid1, cell),
          seg2 = that.isCellOverSegment(mid1, mid2, cell),
          seg3 = that.isCellOverSegment(mid2, mid4, cell),
          seg4 = that.isCellOverSegment(mid4, mid5, cell),
          seg5 = that.isCellOverSegment(mid4, that.to, cell);
      if(seg1 || seg2 || seg3 || seg4 || seg5){
        return true;
      }
      return false;
    };

    that.toJson = function(){
      //Define type, start point(s), end point(e)
      return '{"t":"arc","s": ['+that.from.x+','+that.from.y+'],"e":['+that.to.x+','+that.to.y+'],'+that.lineToJson()+'}';
    };

    return that;
  };

  var semicircle = function(cell){
    var that = segment();
    that.from = cell;
    
    that.draw = function(context, selected){ 
      var cx,cy,d;
      cx = ((that.from.x+that.to.x)/2).toFixed(0);
      cy = ((that.from.y+that.to.y)/2).toFixed(0);
      d = Math.sqrt(Math.pow(that.to.x-that.from.x,2) + Math.pow(that.to.y-that.from.y,2));
      that.startAngle = Math.atan2(that.to.y-that.from.y,that.to.x-that.from.x);
      that.endAngle = that.startAngle - Math.PI;
      context.beginPath();
      context.arc(cx, cy, d/2, that.startAngle, that.endAngle, true);
      that.lineDraw(context, selected);
      that.center = {x:cx,y:cy};
      that.radius = d/2;
    };

    that.toJson = function(){
      //Define type, start point(s), end point(e)
      return '{"t":"semicircle","s": ['+that.from.x+','+that.from.y+'],"e":['+that.to.x+','+that.to.y+'],'+that.lineToJson()+'}';
    };

    that.contains = function(cell){
      var angleX, angleY,
          d = Math.sqrt(Math.pow(that.center.x-cell.x,2) + Math.pow(that.center.y-cell.y,2)),
          hysteresis = 5;
      if (d > (that.radius + hysteresis)  || d < (that.radius - hysteresis)){
        return false;
      }
      //TODO: improve it
      // angleX = Math.acos((cell.x - that.center.x)/that.radius);
      // angleY = Math.asin((cell.y - that.center.y)/that.radius);
      // if (angleX < that.startAngle || angleY < that.startAngle || angleX > that.endAngle || angleY > that.endAngle){
      //   console.log([angleX,angleY,that.startAngle,that.endAngle]);
      //   return false;
      // }
      return true;
    };

    return that;
  };

  var pencil = function(cell){
    var that = polygon();;
    that.points = [cell];
   
    that.draw = function(context, selected){
      context.beginPath();
      for(var k = 0; k < that.points.length; k++){
        var point = that.points[k];
        if(k===0){
          context.moveTo(point.x, point.y);
        }else{
          context.lineTo(point.x, point.y);
          that.lineDraw(context, selected);
        }
      }
    };

    that.isValid = function(){
      if(that.points.length < 4){
        return false;
      }
      return true;
    };

    that.contains = function(){
      return false; //can not be selected
    };

    that.update = function(cell) {
      that.points.push(cell);
    };

    that.toJson = function(){
      //Define type, and array of points(p)
      var jsonString = '{"t":"pencil","p":['
      for(var k = 0; k < that.points.length; k++){
        var point = that.points[k];
        jsonString += '{"x":'+point.x+',"y":'+point.y+'}';
        if(k!=that.points.length-1)
          jsonString+=',';
      }
      jsonString += ']}';
      return jsonString;
    };

    that.fromJson = function(jsonObj){
      var k;
      that.points = jsonObj.p;
    };

    return that;
  };

  function getCursorPosition(e, canvas){
    var x,y;
    
    if (e.layerX || e.layerX == 0) { // Firefox
      x = e.layerX;
      y = e.layerY;
    } else if (e.offsetX || e.offsetX == 0) { // Opera
      x = e.offsetX;
      y = e.offsetY;
    }
    
    if(e.pageX || e.pageY){
      x = e.pageX;
      y = e.pageY;
    }else{
      x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
      y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    x = x - canvas.offsetLeft;// - canvas_container.offsetLeft;
    y = y - canvas.offsetTop;// - canvas_container.offsetTop;
    var cell = {x:x,y:y}
    return cell;
  }

  // The general-purpose event handler. This function just determines the mouse 
  // position relative to the canvas element.
  function ev_canvas (ev) {
    if(ev.button !== 0 && (ev.touches.length < 1 && ev.type !== "touchend")){ //only right button and not finger
      return; 
    }
    if(ev.type.match(/touch/)){
      // Attach the mousedown, mousemove and mouseup event listeners.
      document.body.addEventListener('touchmove', preventDefaultTouch(event), false);
    }
    var pos = getCursorPosition(ev,canvas);
    var func = tool[ev.type];
    if(func){
     if(ev.type === "mousedown" || ev.type === "touchstart"){
       changed = true;
      }
      func(pos);
    }
    document.body.removeEventListener('touchmove', preventDefaultTouch);
  }

  function preventDefaultTouch(event) {
      event.preventDefault();
  }; 

  // The event handler for any changes made to the tool selector.
  function ev_tool_change (ev) {
    if (this.value === "mover" ){
      tool = createMoveTool();
    }else if(this.value === "deleter"){
      tool = createDeleteTool();
    }else if(this.value === "duplicator"){
      tool = createDuplicatorTool();
    }else if(this.value === "bucket"){
      tool = createBucketTool();
    }else{
      tool = createTool(this.value);
    }
  }

  function stroke_color_change(ev){
    strokeColor = this.value;
  }

  function fill_color_change(ev){
    fillColor = this.value;
  }

  function clearImage(){
    context.drawImage(canvas, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function resetImage(ev){
    polygons = [];
    changed = true;
    img_update();
  }

  function backImage(ev){
    polygons.pop();
    img_update();
  }

  function img_update () {
    clearImage();
    for(var i=0; i<polygons.length;i++){
      var polygon = polygons[i];
      polygon.draw(context);
    }
  }

  var createTool = function (s) {
    var that = {};
    that.started = false;
    var pol;
    var shape = eval(s);

    that.mousedown = function (pos) {
      pol = shape(pos);
      pol.strokeStyle = strokeColor;
      if(typeof pol.fillStyle !== undefined)
        pol.fillStyle = fillColor;
      that.started = true;
    };

    that.mousemove = function (pos) {
      if (!that.started) {
        return;
      }
      img_update();
      pol.update(pos);
      pol.draw(context);
    };

    that.mouseup = function (pos) {
      if (!that.started) {
        return;
      }
      pol.update(pos);
      if(pol.isValid()){
        polygons.push(pol);
      }
      img_update();
      that.started = false;
    };

    that.touchend = function(){
      //touchend does not have a position
      if (!that.started) {
        return;
      }
      if(pol.isValid()){
        polygons.push(pol);
      }
      img_update();
      that.started = false;
    };

    that.touchstart = that.mousedown;
    that.touchmove = that.mousemove;

    return that;
  };

  var createMoveTool = function () {
    var that = {};
    var pol;
    
    that.started = false;
    that.startPosition;
    
    that.mousedown = function (pos) {
      var i;
      pol = undefined;
      that.startPosition = pos; 
      for(i = polygons.length -1 ; i >= 0;i-=1){
        var polygon = polygons[i]; 
        if(polygon.contains(pos)===true){
          pol = polygon;
          that.started = true;
          polygons.splice(i,1);
          break;
        }
      }
      if(pol){
        pol.draw(context, true);
      }
    };

    that.getIncrement = function(pos){
      var x = pos.x - that.startPosition.x,
          y = pos.y - that.startPosition.y;
      that.startPosition = pos;
      return {x:x,y:y};
    };

    that.mousemove = function (pos) {
      if (!that.started) {
        return;
      }
      var incr = that.getIncrement(pos);
      img_update();
      pol.move(incr);
      pol.draw(context,true);
    };

    that.mouseup = function (pos) {
      if (!that.started) {
         return;
      }
      var incr = that.getIncrement(pos);
      pol.move(incr);
      polygons.push(pol);
      img_update();
      that.started = false;
    };

    that.touchend = function(){
      //touchend does not have a position
     if (!that.started) {
         return;
      }
      polygons.push(pol);
      img_update();
      that.started = false;
    };

    that.touchstart = that.mousedown;
    that.touchmove = that.mousemove;

    return that;
  };

  var createDeleteTool = function () {
    var that = {};
    that.mousedown = function (pos) {
      var i;
      for(i = polygons.length -1 ; i >= 0;i-=1){
        var polygon = polygons[i]; 
        if(polygon.contains(pos)===true){
          polygons.splice(i,1);
          break;
        }
      }
      img_update();
    };

    that.touchstart = that.mousedown;

    return that;
  };

  var createDuplicatorTool = function () {
    var that = {};
    
    that.started = false;
    that.startPosition;

    that.mousedown = function (pos) {
      var i;
      that.startPosition = pos; 
      pol = undefined;
      for(i = polygons.length -1 ; i >= 0;i-=1){
        var polygon = polygons[i]; 
        if(polygon.contains(pos)===true){
          pol = that.copy(polygon);
          that.started = true;
          break;
        }
      }
      if(pol){
        pol.draw(context,true);
      }
    };

    that.copy = function(pol){
      var jsonPol,newPol;
      jsonPol = JSON.parse(pol.toJson());
      newPol = eval(jsonPol['t']+"()");
      newPol.fromJson(jsonPol);
      return newPol;
    };

     that.getIncrement = function(pos){
      var x = pos.x - that.startPosition.x,
          y = pos.y - that.startPosition.y;
      that.startPosition = pos;
      return {x:x,y:y};
    };

    that.mousemove = function (pos) {
      if (!that.started) {
        return;
      }
      var incr = that.getIncrement(pos);
      img_update();
      pol.move(incr);
      pol.draw(context,true);
    };

    that.mouseup = function (pos) {
      if (!that.started) {
         return;
      }
      var incr = that.getIncrement(pos);
      pol.move(incr);
      polygons.push(pol);
      img_update();
      that.started = false;
    };

    that.touchend = function(){
      //touchend does not have a position
      if (!that.started) {
         return;
      }
      polygons.push(pol);
      img_update();
      that.started = false;
    };

    that.touchstart = that.mousedown;
    that.touchmove = that.mousemove;

    return that;
  };

  var createBucketTool = function () {
    var that = {};
    that.mousedown = function (pos) {
      var i;
      for(i = polygons.length -1 ; i >= 0;i-=1){
        var polygon = polygons[i]; 
        if(polygon.contains(pos)===true){
          polygon.strokeStyle = strokeColor;
          if(typeof polygon.fillStyle !== undefined)
            polygon.fillStyle = fillColor;
          } 
      }
      img_update();
    };

    that.touchstart = that.mousedown;

    return that;
  };

  API.initialize = function() {
    // Find the canvas element.
    canvas = document.getElementById('imageView');
    if (!canvas) {
      //alert('Error: I cannot find the canvas element!');
      return;
    }
    canvas_container = document.getElementById('container');
    canvas.onselectstart = function () { return false; }; /*fix chrome bug when select*/

    if (!canvas.getContext) {
      alert('Error: no canvas.getContext!');
      return;
    }

    // Get the 2D canvas context.
    context = canvas.getContext('2d');
    if (!context) {
      alert('Error: failed to getContext!');
      return;
    }

    // Get the tool select input.
    var tool_select = document.getElementById('dtool');
    if (!tool_select) {
      alert('Error: failed to get the dtool element!');
      return;
    }
    tool_select.addEventListener('change', ev_tool_change, false);
    tool = createTool(default_tool);//default value
    
    var stroke_color_select = document.getElementById('dstroke');
    stroke_color_select.addEventListener('change', stroke_color_change, false);
    var fill_color_select = document.getElementById('dfill');
    fill_color_select.addEventListener('change', fill_color_change, false);
    
    // Attach the mousedown, mousemove and mouseup event listeners.
    canvas.addEventListener('mousedown', ev_canvas, false);
    canvas.addEventListener('mousemove', ev_canvas, false);
    canvas.addEventListener('mouseup',  ev_canvas, false);
    canvas.addEventListener('touchstart', ev_canvas , false);
    canvas.addEventListener('touchmove', ev_canvas, false);
    canvas.addEventListener('touchend',  ev_canvas, false);

    
    var reset_button = document.getElementById('reset');
    reset_button.addEventListener('click', resetImage, false);
    //var back_button = document.getElementById('back');
    //back_button.addEventListener('mouseup', backImage, false);
  };

  API.polygonsToJson = function(){
    if (polygons.length == 0){
      return "";
    }

    var jsonString = '[';

    for (i=0; i<polygons.length; i++){
      jsonString += polygons[i].toJson()
      if(i!=polygons.length-1)
        jsonString+=',';
    };

    jsonString += ']'
    return jsonString;
  };

  API.polygonsFromJson = function(jsonPolygonsArray){
    var i, pol,jsonPolygon;
    
    for (i=0; i<jsonPolygonsArray.length; i++){
      jsonPolygon = jsonPolygonsArray[i];
      pol = eval(jsonPolygon['t']+"()");
      pol.fromJson(jsonPolygon);
      polygons.push(pol);
    };
    img_update();
  };

  API.isChanged = function(){
    return changed;
  } 

  return API;
})();

if(window.addEventListener) {
  window.onload = function() {
    Sketch.initialize();
  };
}

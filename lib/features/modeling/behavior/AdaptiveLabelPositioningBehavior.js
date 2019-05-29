import inherits from 'inherits';

import {
  getOrientation,
  getMid,
  asTRBL
} from 'diagram-js/lib/layout/LayoutUtil';

import {
  substract
} from 'diagram-js/lib/util/Math';

import {
  hasExternalLabel
} from '../../../util/LabelUtil';

import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

var ALIGNMENTS = [
  'top',
  'bottom',
  'left',
  'right'
];

var ELEMENT_LABEL_DISTANCE = 0;


/**
 * A component that makes sure that external labels are added
 * together with respective elements and properly updated (DI wise)
 * during move.
 *
 * @param {EventBus} eventBus
 * @param {Modeling} modeling
 */
export default function AdaptiveLabelPositioningBehavior(eventBus, modeling) {

  CommandInterceptor.call(this, eventBus);

  this.postExecuted([
    'connection.create',
    'connection.layout',
    'connection.updateWaypoints'
  ], function(event) {

    var context = event.context,
        connection = context.connection;

    var source = connection.source,
        target = connection.target;

    checkLabelAdjustment(source);
    checkLabelAdjustment(target);
  });


  this.postExecuted([
    'label.create'
  ], function(event) {
    checkLabelAdjustment(event.context.shape.labelTarget);
  });


  function checkLabelAdjustment(element) {

    // skip non-existing labels
    if (!hasExternalLabel(element)) {
      return;
    }

    var optimalPosition = getOptimalPosition(element);

    // no optimal position found
    if (!optimalPosition) {
      return;
    }

    adjustLabelPosition(element, optimalPosition);
  }

  function adjustLabelPosition(element, orientation) {

    var label = element.label,
        labelMid = getMid(label),
        newLabelMid = getNewLabelMid(element, orientation);

    var delta = substract(newLabelMid, labelMid);

    modeling.moveShape(label, delta);
  }

}

inherits(AdaptiveLabelPositioningBehavior, CommandInterceptor);

AdaptiveLabelPositioningBehavior.$inject = [
  'eventBus',
  'modeling'
];

// helpers //////////////////////


/**
 * Return the optimal label position around an element
 * or _undefined_, if none was found.
 *
 * @param  {Shape} element
 *
 * @return {String} positioning identifier
 */
function getOptimalPosition(element) {

  var labelMid = getMid(element.label);

  var elementMid = getMid(element);

  var labelOrientation = getApproximateOrientation(elementMid, labelMid);

  if (!isAligned(labelOrientation)) {
    return;
  }

  // retrieve connection alignments
  var takenAlignments = [].concat(
    element.incoming.map(function(c) {
      return c.waypoints[c.waypoints.length - 2 ];
    }),
    element.outgoing.map(function(c) {
      return c.waypoints[1];
    })
  ).map(function(point) {
    return getApproximateOrientation(elementMid, point);
  });

  var freeAlignments = ALIGNMENTS.filter(function(alignment) {

    return takenAlignments.indexOf(alignment) === -1;
  });

  // NOTHING TO DO; label already aligned a.O.K.
  if (freeAlignments.indexOf(labelOrientation) !== -1) {
    return;
  }

  if (element.host) {

    var hostElement = element.host;

    freeAlignments = freeAlignments.filter(function(a) {

      // check whether newLabel mid  intersect
      var newLabelMid = getNewLabelMid(element, a),
          hostOrientation = getOrientation(hostElement, newLabelMid, 20);

      // prevent placing boundary label onto host
      if (hostOrientation === 'intersect') {
        return false;
      }

      // TODO: Go back to default or just freeAlignment[0]?

      return a;
    });

  }


  return freeAlignments[0];
}

function getApproximateOrientation(p0, p1) {
  return getOrientation(p1, p0, 5);
}

function isAligned(orientation) {
  return ALIGNMENTS.indexOf(orientation) !== -1;
}

function getNewLabelMid(element, orientation) {

  var elementMid = getMid(element),
      label = element.label,
      elementTrbl = asTRBL(element);

  switch (orientation) {
  case 'top':

    return {
      x: elementMid.x,
      y: elementTrbl.top - ELEMENT_LABEL_DISTANCE - label.height / 2
    };

  case 'left':

    return {
      x: elementTrbl.left - ELEMENT_LABEL_DISTANCE - label.width / 2,
      y: elementMid.y
    };

  case 'bottom':

    return {
      x: elementMid.x,
      y: elementTrbl.bottom + ELEMENT_LABEL_DISTANCE + label.height / 2
    };

  case 'right':

    return {
      x: elementTrbl.right + ELEMENT_LABEL_DISTANCE + label.width / 2,
      y: elementMid.y
    };

  }
}

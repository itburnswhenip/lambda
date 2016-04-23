function DefaultContext() {
  function evaluate(Operator) {
    return (new Operator()).evaluate(Context.EMPTY);
  }

  var seq = (new ApplicationNode(
    FixNode.INSTANCE,
    new LambdaNode('f', null, new LambdaNode('x', null, new VariableNode('f')))
  )).evaluate(Context.EMPTY);

  Context.call(this, {
    'typeof': evaluate(TypeOfOperator),
    'not': evaluate(LogicalNotOperator),
    'seq': seq,
    '~': evaluate(BitwiseNotOperator),
    '+': evaluate(PlusOperator),
    '-': evaluate(MinusOperator),
    '*': evaluate(MultiplyOperator),
    '/': evaluate(DivideOperator),
    '**': evaluate(PowerOperator),
    '%': evaluate(ModulusOperator),
    '<': evaluate(LessThanOperator),
    '<=': evaluate(LessThanOrEqualOperator),
    '>': evaluate(GreaterThanOperator),
    '>=': evaluate(GreaterThanOrEqualOperator),
    '&': evaluate(BitwiseAndOperator),
    '|': evaluate(BitwiseOrOperator),
    '^': evaluate(BitwiseXorOperator),
    '<<': evaluate(LeftShiftOperator),
    '>>': evaluate(RightShiftOperator),
    '=': evaluate(ComparisonOperator),
    '!=': evaluate(NegatedComparisonOperator),
    'and': evaluate(LogicalAndOperator),
    'or': evaluate(LogicalOrOperator),
    'xor': evaluate(LogicalXorOperator)
  });
}

exports.DefaultContext = DefaultContext;

DefaultContext.prototype = Object.create(Context.prototype);

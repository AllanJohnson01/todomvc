$(function() {
  function enterKey(element) {
    var KEYCODE_ENTER = 13
    return element.asEventStream("keyup").filter(function(e) { return e.keyCode == KEYCODE_ENTER })
  }

  function TodoView(todo) {
    var todoTemplate = Handlebars.compile($("#todo-template").html())
    var todoElement = $(todoTemplate(todo))
    var $label = todoElement.find("label")
    var $editor = todoElement.find(".edit")
    var title = Bacon.UI.textFieldValue($editor, todo.title)
    var completed = Bacon.UI.checkBoxValue(todoElement.find(".toggle"), todo.completed)

    todoElement.asEventStream("dblclick").merge(enterKey($editor)).onValue(function() { todoElement.toggleClass("editing") })
    title.assign($label, "text")

    var todoProperty = Bacon.combineTemplate({
      id: todo.id,
      title: title,
      completed: completed
    })

    return {
      changes: todoProperty.changes(),
      element: todoElement
    }
  }

  function TodoListView(listElement, model) {
    model.clearCompleted.map(model.allTodos).onValue(function(todos) {
      listElement.children().remove()
      _.each(todos, addTodo)
    })

    model.todoAdded.onValue(function(todo) {
      addTodo(todo)
    })

    function addTodo(todo) {
      var view = TodoView(todo)
      listElement.append(view.element)
      model.todoModified.plug(view.changes)
    }
  }

  function NewTodoView(element, model) {
    var newTodoId = enterKey(element).scan(0, function(id,_) { return id + 1 })
    var todoAdded = Bacon.combineTemplate({ 
      id: newTodoId,
      title: Bacon.UI.textFieldValue(element),
      completed: false
    }).sampledBy(newTodoId.changes())
    todoAdded.onValue(function() { element.val("") })
    model.todoAdded.plug(todoAdded)
  }

  function ClearCompletedView(element, model) {
    model.completedTodos.map(function(todos) { return todos.length > 0 }).assign(element, "toggle")
    model.clearCompleted.plug(element.asEventStream("click"))
  }


  function TodoCountView(element, model) {
     model.activeTodos.map(".length").assign(element.find("strong"), "text")
  }

  function TodoListModel() {
    function update(todos, updatedTodo) {
      return _.map(todos, function(todo) { return todo.id === updatedTodo.id ? updatedTodo : todo })
    }

    this.todoAdded = new Bacon.Bus()
    this.todoModified = new Bacon.Bus()
    this.clearCompleted = new Bacon.Bus()

    todoChanges = this.todoAdded
                    .map(function(newTodo) { return function(todos) { return todos.concat([newTodo]) }})
                    .merge(this.clearCompleted.map(function() { return function(todos) { return _.where(todos, {completed : false})}}))
                    .merge(this.todoModified.map(function(todo) { return function(todos) { return update(todos, todo) }}))

    this.allTodos = todoChanges.scan([], function(todos, f) { return f(todos) })
    this.activeTodos = this.allTodos.map(function(todos) { return _.where(todos, { completed: false})})
    this.completedTodos = this.allTodos.map(function(todos) { return _.where(todos, { completed: true})})
  }

  function TodoApp() {
    var model = new TodoListModel()
    TodoListView($("#todo-list"), model)
    NewTodoView($("#new-todo"), model)
    ClearCompletedView($("#clear-completed"), model)
    TodoCountView($("#todo-count"), model)
  }

  TodoApp()
})

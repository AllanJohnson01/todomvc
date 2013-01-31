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

  function TodoListView(listElement, model, selectedTodos, filterChanges) {
    var repaint = model.clearCompleted.merge(filterChanges).merge(model.toggleCompleted)
    repaint.map(selectedTodos).onValue(function(todos) {
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

  function ToggleAllView(element, model, selectedTodos) {
    model.toggleCompleted.plug(selectedTodos.sampledBy(Bacon.UI.checkBoxValue(element).changes(), function(todos, completed) {
      return { selectedTodos: todos, completed: completed }
    }))
  }

  function FilterView(element, model) {
    var hash = Bacon.UI.hash("#/")
    var selectedTodos = hash.decode({
      "#/": model.allTodos,
      "#/active": model.activeTodos,
      "#/completed": model.completedTodos
    })
    hash.onValue(function(hash) {
      element.find("a").each(function() {
        var link = $(this)
        link.toggleClass("selected", link.attr("href") == hash)
      })
    })
    return {
      selectedTodos: selectedTodos,
      changes: hash.changes()
    }
  }

  function TodoCountView(element, model) {
     model.activeTodos.map(".length").assign(element.find("strong"), "text")
  }

  function TodoListModel() {
    function update(todos, updatedTodo) {
      return _.map(todos, function(todo) { return todo.id === updatedTodo.id ? updatedTodo : todo })
    }
    function toggleCompleted(todos, toggle) {
      var ids = _.pluck(toggle.selectedTodos, "id")
      return _.map(todos, function(todo) { 
        if (_.contains(ids, todo.id)) {
          return _.extend(_.clone(todo), { completed: toggle.completed })
        }
        return todo
      })
    }

    this.todoAdded = new Bacon.Bus()
    this.todoModified = new Bacon.Bus()
    this.clearCompleted = new Bacon.Bus()
    this.toggleCompleted = new Bacon.Bus()

    todoChanges = this.todoAdded
                    .map(function(newTodo) { return function(todos) { return todos.concat([newTodo]) }})
                    .merge(this.clearCompleted.map(function() { return function(todos) { return _.where(todos, {completed : false})}}))
                    .merge(this.todoModified.map(function(todo) { return function(todos) { return update(todos, todo) }}))
                    .merge(this.toggleCompleted.map(function(toggle) { return function(todos) { return toggleCompleted(todos, toggle)}}))

    this.allTodos = todoChanges.scan([], function(todos, f) { return f(todos) })
    this.activeTodos = this.allTodos.map(function(todos) { return _.where(todos, { completed: false})})
    this.completedTodos = this.allTodos.map(function(todos) { return _.where(todos, { completed: true})})
  }

  function TodoApp() {
    model = new TodoListModel()
    var filter = FilterView($("#filters"), model)
    TodoListView($("#todo-list"), model, filter.selectedTodos, filter.changes)
    NewTodoView($("#new-todo"), model)
    ClearCompletedView($("#clear-completed"), model)
    TodoCountView($("#todo-count"), model)
    ToggleAllView($("#toggle-all"), model, filter.selectedTodos)
  }

  TodoApp()
})

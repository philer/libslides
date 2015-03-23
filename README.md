# libslides
Simple presentation library for doing slides in html

### Usage
1. Write an html file containing the following tags:
  * `<slide>` or `<div class="slide">`, containig any sort of children
  * `<style>` and `<script>` for custom scripting
  * `<title>` if you want to specify a custom document title
  * `<script src="path/to/jQuery.js"></script>` libslides requires jQuery but does not ship it
  * `<script src="libslides/presentation.js"></script>` This needs to be at the very end of the file, everything past it will be ignored.
2. Make sure that `libslides/` is inside the same directory as your html file.
3. Open your html file in an up-to-date Browser.
        

### TODO
* example.html
* check compatibility
* ...?
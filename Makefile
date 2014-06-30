CSSMIN = cssmin
CSSOUTPUT = ./public/css/style.min.css

ALL: clean minify

clean: 
	@rm -f $(CSSOUTPUT)

minify: clean
	@$(CSSMIN) ./public/css/style.css > $(CSSOUTPUT)